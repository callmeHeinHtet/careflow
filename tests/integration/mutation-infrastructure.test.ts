import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { seedCareFlow } from "../../prisma/seed";
import { disconnectDb } from "../../src/server/db/client";
import { resetTestDb, createTestDb } from "../../src/server/db/reset-test-db";
import { AppError } from "../../src/server/http/app-error";
import { writeAuditEvent } from "../../src/server/audit/write-audit-event";
import { runIdempotentMutation } from "../../src/server/http/idempotency";

const db = createTestDb();

beforeEach(async () => {
  await resetTestDb(db);
  await seedCareFlow(db);
});

afterAll(async () => {
  await db.$disconnect();
  await disconnectDb();
});

describe("transactional mutation infrastructure", () => {
  it("replays a completed result once without executing the mutation twice", async () => {
    const actor = await db.user.findUniqueOrThrow({ where: { email: "admin@careflow.test" } });
    let executions = 0;
    const execute = async () => {
      executions += 1;
      return { status: 201, body: { patientId: "patient-1" } };
    };
    const input = {
      actorUserId: actor.id,
      scope: "patients.register",
      key: "register_01J7Z8M4D73B6F2K9P0Q",
      payload: { firstName: "May", lastName: "Aung" },
      execute,
    };

    const first = await runIdempotentMutation(db, input);
    const replay = await runIdempotentMutation(db, input);

    expect(first).toMatchObject({ replayed: false, status: 201 });
    expect(replay).toMatchObject({ replayed: true, status: 201 });
    expect(executions).toBe(1);
  });

  it("rejects reuse of an idempotency key with a different payload", async () => {
    const actor = await db.user.findUniqueOrThrow({ where: { email: "admin@careflow.test" } });
    const base = {
      actorUserId: actor.id,
      scope: "patients.register",
      key: "register_01J7Z8M4D73B6F2K9P0Q",
      execute: async () => ({ status: 201, body: { ok: true } }),
    };
    await runIdempotentMutation(db, { ...base, payload: { firstName: "May" } });

    await expect(
      runIdempotentMutation(db, { ...base, payload: { firstName: "Ei" } }),
    ).rejects.toEqual(expect.objectContaining({ code: "IDEMPOTENCY_CONFLICT", status: 409 }));
  });

  it("rolls audit events back with a failed transaction", async () => {
    const actor = await db.user.findUniqueOrThrow({
      where: { email: "admin@careflow.test" },
      include: { staffProfile: true },
    });

    await expect(
      db.$transaction(async (tx) => {
        await writeAuditEvent(tx, {
          actorUserId: actor.id,
          actorName: actor.staffProfile!.displayName,
          role: actor.staffProfile!.role,
          action: "PATIENT_REGISTERED",
          entityType: "Patient",
          entityId: "patient-1",
          correlationId: "b9355746-c39d-4cf4-beb2-dc8ce13cf065",
        });
        throw new AppError("CONFLICT", "Rollback", 409);
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(await db.auditEvent.count()).toBe(3);
  });

  it("prevents normal updates and deletes of audit events", async () => {
    const audit = await db.auditEvent.findFirstOrThrow();

    await expect(
      db.auditEvent.update({ where: { id: audit.id }, data: { action: "CHANGED" } }),
    ).rejects.toThrow();
    await expect(db.auditEvent.delete({ where: { id: audit.id } })).rejects.toThrow();
  });
});

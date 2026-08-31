import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { seedCareFlow } from "../../prisma/seed";
import { disconnectDb } from "../../src/server/db/client";
import { createTestDb, resetTestDb } from "../../src/server/db/reset-test-db";
import { getVisitById, listVisits } from "../../src/server/repositories/visit-repository";
import { recordTriage, updateVisitPriority } from "../../src/server/services/visit-service";

const db = createTestDb();
const nurse = {
  userId: "90000000-0000-4000-8000-000000000002",
  displayName: "Maya Win",
  role: "NURSE" as const,
  correlationId: "7b6f9c22-27fa-4282-b1bd-6443c3960c66",
  ipAddress: "127.0.0.1",
};

beforeEach(async () => {
  await resetTestDb(db);
  await seedCareFlow(db);
});

afterAll(async () => {
  await db.$disconnect();
  await disconnectDb();
});

describe("visit reads and workflows", () => {
  it("lists bounded visits and returns a complete detail", async () => {
    const page = await listVisits(db, { stage: "WAITING", limit: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).not.toBeNull();
    expect(page.items[0]).toMatchObject({ stage: "WAITING", patient: { medicalRecordNumber: expect.any(String) } });
    expect(await getVisitById(db, page.items[0].id)).toMatchObject({ id: page.items[0].id });
  });

  it("changes queue priority with a version check and audit event", async () => {
    const visit = await db.visit.findUniqueOrThrow({ where: { queueToken: "OPD-018" } });
    const changed = await updateVisitPriority(
      db,
      visit.id,
      { version: 1, priority: "CRITICAL" },
      nurse,
      "priority_update_0001",
    );
    expect(changed.body.data.visit).toMatchObject({ priority: "CRITICAL", version: 2 });
    expect(await db.auditEvent.count({ where: { action: "VISIT_PRIORITY_UPDATED" } })).toBe(1);

    await expect(
      updateVisitPriority(
        db,
        visit.id,
        { version: 1, priority: "ROUTINE" },
        nurse,
        "priority_update_0002",
      ),
    ).rejects.toMatchObject({ code: "CONFLICT", details: { currentVersion: 2 } });
  });

  it("records triage and transitions the visit atomically", async () => {
    const visit = await db.visit.findUniqueOrThrow({ where: { queueToken: "OPD-019" } });
    const result = await recordTriage(
      db,
      visit.id,
      {
        version: 1,
        temperature: 37.2,
        bloodPressure: "120/80",
        heartRate: 82,
        oxygenSat: 98,
        symptoms: "Persistent cough",
        notes: "Patient-reported symptoms recorded.",
        priority: "SOON",
      },
      nurse,
      "triage_record_0001",
    );

    expect(result.body.data.visit).toMatchObject({ stage: "CONSULTATION", version: 2 });
    expect(await db.triageObservation.count({ where: { visitId: visit.id } })).toBe(1);
    expect(await db.auditEvent.count({ where: { action: "TRIAGE_RECORDED" } })).toBe(1);
  });

  it("rejects triage outside waiting or triage stages without partial writes", async () => {
    const visit = await db.visit.findUniqueOrThrow({ where: { queueToken: "OPD-017" } });
    await expect(
      recordTriage(
        db,
        visit.id,
        {
          version: 1,
          temperature: 37,
          bloodPressure: "120/80",
          heartRate: 80,
          oxygenSat: 98,
          symptoms: "Knee pain",
          notes: "No change",
          priority: "SOON",
        },
        nurse,
        "triage_record_0002",
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await db.triageObservation.count({ where: { visitId: visit.id } })).toBe(0);
  });
});

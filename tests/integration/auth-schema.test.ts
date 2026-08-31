import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { AccountStatus, StaffRole } from "../../src/generated/prisma/client";
import { createTestDb, resetTestDb } from "../../src/server/db/reset-test-db";

const db = createTestDb();

beforeEach(async () => resetTestDb(db));
afterAll(async () => db.$disconnect());

describe("authentication persistence", () => {
  it("stores an invited staff identity and revocable MFA-aware session", async () => {
    const user = await db.user.create({
      data: {
        email: "admin@careflow.test",
        status: AccountStatus.INVITED,
        staffProfile: {
          create: {
            employeeNumber: "CF-ADM-001",
            displayName: "CareFlow Admin",
            role: StaffRole.ADMIN,
          },
        },
      },
      include: { staffProfile: true },
    });

    const session = await db.session.create({
      data: {
        sessionToken: "test-session-token",
        userId: user.id,
        expires: new Date("2026-09-01T12:00:00.000Z"),
        absoluteExpiresAt: new Date("2026-09-01T12:00:00.000Z"),
      },
    });

    expect(user.staffProfile?.role).toBe(StaffRole.ADMIN);
    expect(session.mfaVerifiedAt).toBeNull();
    expect(session.lastSeenAt).toBeInstanceOf(Date);
  });

  it("enforces unique employee numbers and recovery-code hashes per user", async () => {
    const first = await db.user.create({
      data: {
        email: "first@careflow.test",
        staffProfile: {
          create: { employeeNumber: "CF-001", displayName: "First User", role: StaffRole.NURSE },
        },
        recoveryCodes: { create: { codeHash: "same-hash" } },
      },
    });

    await expect(
      db.recoveryCode.create({ data: { userId: first.id, codeHash: "same-hash" } }),
    ).rejects.toThrow();

    await expect(
      db.user.create({
        data: {
          email: "second@careflow.test",
          staffProfile: {
            create: { employeeNumber: "CF-001", displayName: "Second User", role: StaffRole.DOCTOR },
          },
        },
      }),
    ).rejects.toThrow();
  });
});

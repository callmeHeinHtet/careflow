import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { AccountStatus, StaffRole } from "../../src/generated/prisma/client";
import { createCareFlowAuthAdapter } from "../../src/server/auth/adapter";
import { createTestDb, resetTestDb } from "../../src/server/db/reset-test-db";

const db = createTestDb();

beforeEach(async () => resetTestDb(db));
afterAll(async () => db.$disconnect());

describe("CareFlow Auth.js adapter", () => {
  it("creates an MFA-pending session with a bounded absolute lifetime", async () => {
    const user = await db.user.create({
      data: {
        email: "admin@careflow.test",
        status: AccountStatus.ACTIVE,
        staffProfile: {
          create: {
            employeeNumber: "CF-ADM-001",
            displayName: "CareFlow Admin",
            role: StaffRole.ADMIN,
          },
        },
      },
    });
    const adapter = createCareFlowAuthAdapter(db);
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await adapter.createSession?.({ sessionToken: "adapter-session", userId: user.id, expires });
    const stored = await db.session.findUniqueOrThrow({ where: { sessionToken: "adapter-session" } });

    expect(stored.mfaVerifiedAt).toBeNull();
    expect(stored.absoluteExpiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 12 * 60 * 60 * 1000);
    expect(stored.expires).toEqual(stored.absoluteExpiresAt);
  });

  it("does not persist verification tokens for an ineligible address", async () => {
    const adapter = createCareFlowAuthAdapter(db);

    await adapter.createVerificationToken?.({
      identifier: "unknown@careflow.test",
      token: "hashed-token",
      expires: new Date(Date.now() + 15 * 60 * 1000),
    });

    await expect(db.verificationToken.count()).resolves.toBe(0);
  });
});

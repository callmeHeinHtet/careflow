import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { AccountStatus, StaffRole } from "../../src/generated/prisma/client";
import {
  AuthorizationError,
  authorizeRequest,
} from "../../src/server/auth/authorize";
import { Capability } from "../../src/server/auth/permissions";
import { createTestDb, resetTestDb } from "../../src/server/db/reset-test-db";

const db = createTestDb();
const now = new Date("2026-08-31T00:00:00.000Z");

beforeEach(async () => resetTestDb(db));
afterAll(async () => db.$disconnect());

async function createSession(options?: {
  role?: StaffRole;
  mfaEnrolled?: boolean;
  mfaVerified?: boolean;
  lastSeenAt?: Date;
  expires?: Date;
}) {
  const user = await db.user.create({
    data: {
      email: `${(options?.role ?? StaffRole.NURSE).toLowerCase()}@careflow.test`,
      status: AccountStatus.ACTIVE,
      mfaEnrolledAt: options?.mfaEnrolled === false ? null : now,
      staffProfile: {
        create: {
          employeeNumber: `CF-${options?.role ?? StaffRole.NURSE}`,
          displayName: "Test Staff",
          role: options?.role ?? StaffRole.NURSE,
        },
      },
    },
  });
  const token = `session-token-${user.id}`;
  await db.session.create({
    data: {
      sessionToken: token,
      userId: user.id,
      lastSeenAt: options?.lastSeenAt ?? new Date(now.getTime() - 6 * 60 * 1000),
      expires: options?.expires ?? new Date(now.getTime() + 60 * 60 * 1000),
      absoluteExpiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      mfaVerifiedAt: options?.mfaVerified === false ? null : now,
    },
  });
  return { user, token };
}

function requestWithToken(token?: string) {
  return new NextRequest("http://localhost:3000/api/dashboard", {
    headers: token ? { cookie: `authjs.session-token=${token}` } : undefined,
  });
}

describe("database-backed authorization", () => {
  it("authorizes a capable active MFA session and refreshes bounded idle activity", async () => {
    const { token } = await createSession();

    const context = await authorizeRequest(requestWithToken(token), Capability.DASHBOARD_READ, {
      db,
      now,
    });

    expect(context.role).toBe(StaffRole.NURSE);
    await expect(db.session.findUniqueOrThrow({ where: { sessionToken: token } })).resolves.toMatchObject({
      lastSeenAt: now,
    });
  });

  it("distinguishes missing MFA enrollment, pending MFA, and insufficient role", async () => {
    const notEnrolled = await createSession({ mfaEnrolled: false, role: StaffRole.NURSE });
    await expect(
      authorizeRequest(requestWithToken(notEnrolled.token), Capability.DASHBOARD_READ, { db, now }),
    ).rejects.toMatchObject({ code: "MFA_ENROLLMENT_REQUIRED", status: 403 });

    await resetTestDb(db);
    const pending = await createSession({ mfaVerified: false, role: StaffRole.NURSE });
    await expect(
      authorizeRequest(requestWithToken(pending.token), Capability.DASHBOARD_READ, { db, now }),
    ).rejects.toMatchObject({ code: "MFA_REQUIRED", status: 403 });

    await resetTestDb(db);
    const nurse = await createSession({ role: StaffRole.NURSE });
    await expect(
      authorizeRequest(requestWithToken(nurse.token), Capability.ADMIN_MANAGE, { db, now }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("rejects missing, expired, and idle sessions as unauthenticated", async () => {
    await expect(
      authorizeRequest(requestWithToken(), Capability.DASHBOARD_READ, { db, now }),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const expired = await createSession({ expires: new Date(now.getTime() - 1) });
    await expect(
      authorizeRequest(requestWithToken(expired.token), Capability.DASHBOARD_READ, { db, now }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED", status: 401 });

    await resetTestDb(db);
    const idle = await createSession({ lastSeenAt: new Date(now.getTime() - 31 * 60 * 1000) });
    await expect(
      authorizeRequest(requestWithToken(idle.token), Capability.DASHBOARD_READ, { db, now }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED", status: 401 });
  });
});

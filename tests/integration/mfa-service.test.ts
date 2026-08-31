import * as OTPAuth from "otpauth";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { AccountStatus, StaffRole } from "../../src/generated/prisma/client";
import {
  beginMfaEnrollment,
  confirmMfaEnrollment,
  verifyMfaRecoveryCode,
  verifyMfaTotp,
} from "../../src/server/auth/mfa-service";
import { createTestDb, resetTestDb } from "../../src/server/db/reset-test-db";

const db = createTestDb();
const encryptionKey = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";
const recoveryPepper = "test-recovery-code-pepper-at-least-32-characters";
const enrollmentTime = new Date("2026-08-31T00:00:00.000Z");

beforeEach(async () => resetTestDb(db));
afterAll(async () => db.$disconnect());

async function createUserAndSession(sessionToken = "mfa-session") {
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
  await db.session.create({
    data: {
      sessionToken,
      userId: user.id,
      expires: new Date("2026-09-01T00:00:00.000Z"),
      absoluteExpiresAt: new Date("2026-09-01T00:00:00.000Z"),
    },
  });
  return user;
}

describe("MFA enrollment and verification", () => {
  it("confirms TOTP enrollment transactionally and returns recovery codes once", async () => {
    const user = await createUserAndSession();
    const enrollment = await beginMfaEnrollment(db, user.id, encryptionKey);
    const token = new OTPAuth.TOTP({
      issuer: "CareFlow",
      label: user.email,
      secret: enrollment.secret,
    }).generate({ timestamp: enrollmentTime.getTime() });

    const recoveryCodes = await confirmMfaEnrollment(db, {
      userId: user.id,
      sessionToken: "mfa-session",
      token,
      encryptionKey,
      recoveryPepper,
      now: enrollmentTime,
    });

    expect(recoveryCodes).toHaveLength(8);
    expect(new Set(recoveryCodes).size).toBe(8);
    expect(recoveryCodes.every((code) => /^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(code))).toBe(true);
    const [storedUser, storedSecret, storedCodes, session] = await Promise.all([
      db.user.findUniqueOrThrow({ where: { id: user.id } }),
      db.mfaSecret.findUniqueOrThrow({ where: { userId: user.id } }),
      db.recoveryCode.findMany({ where: { userId: user.id } }),
      db.session.findUniqueOrThrow({ where: { sessionToken: "mfa-session" } }),
    ]);
    expect(storedUser.mfaEnrolledAt).toEqual(enrollmentTime);
    expect(storedSecret.confirmedAt).toEqual(enrollmentTime);
    expect(storedCodes).toHaveLength(8);
    expect(storedCodes.some((code) => recoveryCodes.includes(code.codeHash))).toBe(false);
    expect(session.mfaVerifiedAt).toEqual(enrollmentTime);
  });

  it("rejects an invalid enrollment token without partial writes", async () => {
    const user = await createUserAndSession();
    await beginMfaEnrollment(db, user.id, encryptionKey);

    await expect(
      confirmMfaEnrollment(db, {
        userId: user.id,
        sessionToken: "mfa-session",
        token: "000000",
        encryptionKey,
        recoveryPepper,
        now: enrollmentTime,
      }),
    ).rejects.toThrow("Invalid verification code");

    await expect(db.recoveryCode.count()).resolves.toBe(0);
    await expect(db.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toMatchObject({
      mfaEnrolledAt: null,
    });
  });

  it("upgrades a new session with a fresh TOTP and rejects replay", async () => {
    const user = await createUserAndSession();
    const enrollment = await beginMfaEnrollment(db, user.id, encryptionKey);
    const totp = new OTPAuth.TOTP({ issuer: "CareFlow", label: user.email, secret: enrollment.secret });
    const enrollmentToken = totp.generate({ timestamp: enrollmentTime.getTime() });
    await confirmMfaEnrollment(db, {
      userId: user.id,
      sessionToken: "mfa-session",
      token: enrollmentToken,
      encryptionKey,
      recoveryPepper,
      now: enrollmentTime,
    });
    await db.session.create({
      data: {
        sessionToken: "second-session",
        userId: user.id,
        expires: new Date("2026-09-01T00:00:00.000Z"),
        absoluteExpiresAt: new Date("2026-09-01T00:00:00.000Z"),
      },
    });
    const verificationTime = new Date(enrollmentTime.getTime() + 30_000);
    const token = totp.generate({ timestamp: verificationTime.getTime() });

    await expect(
      verifyMfaTotp(db, {
        userId: user.id,
        sessionToken: "second-session",
        token,
        encryptionKey,
        now: verificationTime,
      }),
    ).resolves.toBe(true);
    await expect(
      verifyMfaTotp(db, {
        userId: user.id,
        sessionToken: "second-session",
        token,
        encryptionKey,
        now: verificationTime,
      }),
    ).resolves.toBe(false);
  });

  it("consumes a recovery code exactly once and upgrades only the owned session", async () => {
    const user = await createUserAndSession();
    const enrollment = await beginMfaEnrollment(db, user.id, encryptionKey);
    const token = new OTPAuth.TOTP({ issuer: "CareFlow", label: user.email, secret: enrollment.secret }).generate({ timestamp: enrollmentTime.getTime() });
    const [recoveryCode] = await confirmMfaEnrollment(db, {
      userId: user.id,
      sessionToken: "mfa-session",
      token,
      encryptionKey,
      recoveryPepper,
      now: enrollmentTime,
    });
    await db.session.update({
      where: { sessionToken: "mfa-session" },
      data: { mfaVerifiedAt: null },
    });

    await expect(
      verifyMfaRecoveryCode(db, {
        userId: user.id,
        sessionToken: "mfa-session",
        code: recoveryCode,
        recoveryPepper,
        now: new Date(enrollmentTime.getTime() + 60_000),
      }),
    ).resolves.toBe(true);
    await expect(
      verifyMfaRecoveryCode(db, {
        userId: user.id,
        sessionToken: "mfa-session",
        code: recoveryCode,
        recoveryPepper,
        now: new Date(enrollmentTime.getTime() + 90_000),
      }),
    ).resolves.toBe(false);
  });
});

import { randomInt } from "node:crypto";
import * as OTPAuth from "otpauth";
import type { PrismaClient } from "../../generated/prisma/client";
import {
  decryptMfaSecret,
  encryptMfaSecret,
  hashRecoveryCode,
} from "./mfa-crypto";

const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function createTotp(secret: string, email: string) {
  return new OTPAuth.TOTP({
    issuer: "CareFlow",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });
}

function generateRecoveryCode(): string {
  let raw = "";
  for (let index = 0; index < 10; index += 1) {
    raw += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
  }
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

function generateRecoveryCodes(): string[] {
  const codes = new Set<string>();
  while (codes.size < 8) codes.add(generateRecoveryCode());
  return [...codes];
}

function isSessionCurrent(
  session: { userId: string; expires: Date; absoluteExpiresAt: Date } | null,
  userId: string,
  now: Date,
) {
  return Boolean(
    session &&
      session.userId === userId &&
      session.expires.getTime() > now.getTime() &&
      session.absoluteExpiresAt.getTime() > now.getTime(),
  );
}

export async function beginMfaEnrollment(
  db: PrismaClient,
  userId: string,
  encryptionKey: string,
) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.mfaEnrolledAt) throw new Error("MFA is already enrolled");

  const secret = new OTPAuth.Secret({ size: 20 }).base32;
  const totp = createTotp(secret, user.email);
  await db.$transaction([
    db.recoveryCode.deleteMany({ where: { userId } }),
    db.mfaSecret.upsert({
      where: { userId },
      create: { userId, encryptedSecret: encryptMfaSecret(secret, encryptionKey, userId) },
      update: {
        encryptedSecret: encryptMfaSecret(secret, encryptionKey, userId),
        keyVersion: 1,
        confirmedAt: null,
        lastUsedCounter: null,
      },
    }),
  ]);

  return { secret, uri: totp.toString() };
}

type ConfirmEnrollmentInput = {
  userId: string;
  sessionToken: string;
  token: string;
  encryptionKey: string;
  recoveryPepper: string;
  now?: Date;
};

export async function confirmMfaEnrollment(
  db: PrismaClient,
  input: ConfirmEnrollmentInput,
): Promise<string[]> {
  const now = input.now ?? new Date();
  const recoveryCodes = generateRecoveryCodes();

  return db.$transaction(async (tx) => {
    const [user, mfaSecret, session] = await Promise.all([
      tx.user.findUniqueOrThrow({ where: { id: input.userId } }),
      tx.mfaSecret.findUnique({ where: { userId: input.userId } }),
      tx.session.findUnique({ where: { sessionToken: input.sessionToken } }),
    ]);
    if (!mfaSecret || mfaSecret.confirmedAt || !isSessionCurrent(session, input.userId, now)) {
      throw new Error("MFA enrollment is not available");
    }

    const secret = decryptMfaSecret(mfaSecret.encryptedSecret, input.encryptionKey, input.userId);
    const totp = createTotp(secret, user.email);
    const delta = totp.validate({ token: input.token, timestamp: now.getTime(), window: 1 });
    if (delta === null) throw new Error("Invalid verification code");
    const counter = totp.counter({ timestamp: now.getTime() }) + delta;

    const confirmed = await tx.mfaSecret.updateMany({
      where: { id: mfaSecret.id, confirmedAt: null },
      data: { confirmedAt: now, lastUsedCounter: counter },
    });
    if (confirmed.count !== 1) throw new Error("MFA enrollment is not available");

    await tx.user.update({ where: { id: input.userId }, data: { mfaEnrolledAt: now } });
    await tx.recoveryCode.deleteMany({ where: { userId: input.userId } });
    await tx.recoveryCode.createMany({
      data: recoveryCodes.map((code) => ({
        userId: input.userId,
        codeHash: hashRecoveryCode(code, input.recoveryPepper),
      })),
    });
    await tx.session.update({
      where: { sessionToken: input.sessionToken },
      data: { mfaVerifiedAt: now },
    });
    return recoveryCodes;
  });
}

type VerifyTotpInput = {
  userId: string;
  sessionToken: string;
  token: string;
  encryptionKey: string;
  now?: Date;
};

export async function verifyMfaTotp(db: PrismaClient, input: VerifyTotpInput): Promise<boolean> {
  const now = input.now ?? new Date();
  return db.$transaction(async (tx) => {
    const [user, mfaSecret, session] = await Promise.all([
      tx.user.findUnique({ where: { id: input.userId } }),
      tx.mfaSecret.findUnique({ where: { userId: input.userId } }),
      tx.session.findUnique({ where: { sessionToken: input.sessionToken } }),
    ]);
    if (!user || !mfaSecret?.confirmedAt || !isSessionCurrent(session, input.userId, now)) return false;

    const secret = decryptMfaSecret(mfaSecret.encryptedSecret, input.encryptionKey, input.userId);
    const totp = createTotp(secret, user.email);
    const delta = totp.validate({ token: input.token, timestamp: now.getTime(), window: 1 });
    if (delta === null) return false;
    const counter = totp.counter({ timestamp: now.getTime() }) + delta;

    const consumed = await tx.mfaSecret.updateMany({
      where: {
        id: mfaSecret.id,
        OR: [{ lastUsedCounter: null }, { lastUsedCounter: { lt: counter } }],
      },
      data: { lastUsedCounter: counter },
    });
    if (consumed.count !== 1) return false;

    await tx.session.update({
      where: { sessionToken: input.sessionToken },
      data: { mfaVerifiedAt: now },
    });
    return true;
  });
}

type VerifyRecoveryInput = {
  userId: string;
  sessionToken: string;
  code: string;
  recoveryPepper: string;
  now?: Date;
};

export async function verifyMfaRecoveryCode(
  db: PrismaClient,
  input: VerifyRecoveryInput,
): Promise<boolean> {
  const now = input.now ?? new Date();
  let codeHash: string;
  try {
    codeHash = hashRecoveryCode(input.code, input.recoveryPepper);
  } catch {
    return false;
  }

  return db.$transaction(async (tx) => {
    const session = await tx.session.findUnique({ where: { sessionToken: input.sessionToken } });
    if (!isSessionCurrent(session, input.userId, now)) return false;

    const consumed = await tx.recoveryCode.updateMany({
      where: { userId: input.userId, codeHash, consumedAt: null },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) return false;

    await tx.session.update({
      where: { sessionToken: input.sessionToken },
      data: { mfaVerifiedAt: now },
    });
    return true;
  });
}

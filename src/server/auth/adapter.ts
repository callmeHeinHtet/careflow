import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import type { PrismaClient } from "../../generated/prisma/client";
import { findEligibleStaff, normalizeStaffEmail } from "./invite-policy";

const ABSOLUTE_SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;

export function createCareFlowAuthAdapter(db: PrismaClient): Adapter {
  const adapter = PrismaAdapter(db);

  return {
    ...adapter,
    async createSession(session) {
      const now = new Date();
      const absoluteLimit = new Date(now.getTime() + ABSOLUTE_SESSION_LIFETIME_MS);
      const absoluteExpiresAt =
        session.expires.getTime() < absoluteLimit.getTime() ? session.expires : absoluteLimit;

      return db.session.create({
        data: {
          ...session,
          expires: absoluteExpiresAt,
          absoluteExpiresAt,
          lastSeenAt: now,
          mfaVerifiedAt: null,
        },
      });
    },
    async createVerificationToken(token) {
      const identifier = normalizeStaffEmail(token.identifier);
      const staff = await findEligibleStaff(db, identifier);
      if (!staff) return { ...token, identifier };

      return db.verificationToken.create({ data: { ...token, identifier } });
    },
  };
}

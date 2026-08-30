import { createTransport } from "nodemailer";
import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { AccountStatus } from "./generated/prisma/client";
import { createCareFlowAuthAdapter } from "./server/auth/adapter";
import { sendCareFlowSignInEmail } from "./server/auth/email";
import { findEligibleStaff, normalizeStaffEmail } from "./server/auth/invite-policy";
import { getDb } from "./server/db/client";
import { getServerEnv } from "./server/env";

const env = getServerEnv();
const db = getDb();
const smtpAuth =
  env.SMTP_USER && env.SMTP_PASSWORD
    ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
    : undefined;
const smtpServer = {
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: smtpAuth,
  disableFileAccess: true,
  disableUrlAccess: true,
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: createCareFlowAuthAdapter(db),
  secret: env.AUTH_SECRET,
  trustHost: true,
  session: {
    strategy: "database",
    maxAge: 12 * 60 * 60,
    updateAge: 15 * 60,
  },
  providers: [
    Nodemailer({
      server: smtpServer,
      from: env.SMTP_FROM,
      maxAge: 15 * 60,
      normalizeIdentifier: normalizeStaffEmail,
      async sendVerificationRequest({ identifier, url, provider }) {
        await sendCareFlowSignInEmail(db, createTransport(smtpServer), {
          identifier,
          url,
          from: provider.from ?? env.SMTP_FROM,
        });
      },
    }),
  ],
  callbacks: {
    async signIn({ user, email }) {
      if (email?.verificationRequest) return true;
      if (!user.email) return false;
      return Boolean(await findEligibleStaff(db, user.email));
    },
    async session({ session, user }) {
      const staff = await db.staffProfile.findUnique({ where: { userId: user.id } });
      const storedSession = session as typeof session & { mfaVerifiedAt?: Date | null };

      session.user.id = user.id;
      session.user.role = staff?.role;
      session.user.employeeNumber = staff?.employeeNumber;
      session.user.displayName = staff?.displayName ?? user.name ?? user.email;
      session.user.mfaEnrolled = Boolean(user.mfaEnrolledAt);
      session.user.mfaVerified = Boolean(storedSession.mfaVerifiedAt);
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      await db.user.update({
        where: { id: user.id },
        data: { status: AccountStatus.ACTIVE, lastLoginAt: new Date() },
      });
    },
  },
});

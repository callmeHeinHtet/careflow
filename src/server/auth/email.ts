import type { PrismaClient } from "../../generated/prisma/client";
import { findEligibleStaff } from "./invite-policy";
import { enforceRateLimit } from "../security/rate-limit";

type SignInMailTransport = {
  sendMail(message: {
    to: string;
    from: string;
    subject: string;
    text: string;
  }): Promise<{ rejected?: unknown[]; pending?: unknown[] }>;
};

type SignInMailRequest = {
  identifier: string;
  url: string;
  from: string;
};

export async function sendCareFlowSignInEmail(
  db: PrismaClient,
  transport: SignInMailTransport,
  request: SignInMailRequest,
): Promise<void> {
  await enforceRateLimit(db, {
    scope: "sign-in",
    identifier: request.identifier,
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  const staff = await findEligibleStaff(db, request.identifier);
  if (!staff) return;

  const result = await transport.sendMail({
    to: staff.email,
    from: request.from,
    subject: "Your CareFlow sign-in link",
    text: [
      `Hello ${staff.staffProfile?.displayName ?? "CareFlow staff member"},`,
      "",
      "Use this single-use link to sign in to CareFlow:",
      request.url,
      "",
      "This link expires in 15 minutes. If you did not request it, you can ignore this email.",
    ].join("\n"),
  });

  const failed = [...(result.rejected ?? []), ...(result.pending ?? [])].filter(Boolean);
  if (failed.length > 0) throw new Error("CareFlow sign-in email could not be delivered");
}

import type { NextRequest } from "next/server";
import { z } from "zod";
import { verifyMfaTotp } from "../../../../../server/auth/mfa-service";
import {
  getActiveSessionContext,
  isSameOriginRequest,
} from "../../../../../server/auth/session-context";
import { getDb } from "../../../../../server/db/client";
import { getServerEnv } from "../../../../../server/env";
import { dataResponse, errorResponse } from "../../../../../server/http/json-response";

const verificationSchema = z.object({ token: z.string().regex(/^\d{6}$/) }).strict();

export async function POST(request: NextRequest): Promise<Response> {
  if (!isSameOriginRequest(request)) return errorResponse("FORBIDDEN", "Request origin is not allowed", 403);
  const session = await getActiveSessionContext(request);
  if (!session) return errorResponse("UNAUTHENTICATED", "Sign in is required", 401);
  if (!session.mfaEnrolled) return errorResponse("MFA_ENROLLMENT_REQUIRED", "MFA enrollment is required", 403);

  const parsed = verificationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("VALIDATION_FAILED", "Enter a valid 6-digit code", 400);

  const verified = await verifyMfaTotp(getDb(), {
    userId: session.userId,
    sessionToken: session.sessionToken,
    token: parsed.data.token,
    encryptionKey: getServerEnv().MFA_ENCRYPTION_KEY,
  });
  if (!verified) return errorResponse("INVALID_MFA_CODE", "The verification code is invalid or expired", 400);
  return dataResponse({ verified: true });
}

import type { NextRequest } from "next/server";
import { z } from "zod";
import { verifyMfaRecoveryCode } from "../../../../../server/auth/mfa-service";
import {
  getActiveSessionContext,
  isSameOriginRequest,
} from "../../../../../server/auth/session-context";
import { getDb } from "../../../../../server/db/client";
import { getServerEnv } from "../../../../../server/env";
import { dataResponse, errorResponse } from "../../../../../server/http/json-response";

const recoverySchema = z.object({ code: z.string().min(10).max(32) }).strict();

export async function POST(request: NextRequest): Promise<Response> {
  if (!isSameOriginRequest(request)) return errorResponse("FORBIDDEN", "Request origin is not allowed", 403);
  const session = await getActiveSessionContext(request);
  if (!session) return errorResponse("UNAUTHENTICATED", "Sign in is required", 401);
  if (!session.mfaEnrolled) return errorResponse("MFA_ENROLLMENT_REQUIRED", "MFA enrollment is required", 403);

  const parsed = recoverySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("VALIDATION_FAILED", "Enter a valid recovery code", 400);

  const verified = await verifyMfaRecoveryCode(getDb(), {
    userId: session.userId,
    sessionToken: session.sessionToken,
    code: parsed.data.code,
    recoveryPepper: getServerEnv().RECOVERY_CODE_PEPPER,
  });
  if (!verified) return errorResponse("INVALID_RECOVERY_CODE", "The recovery code is invalid or used", 400);
  return dataResponse({ verified: true });
}

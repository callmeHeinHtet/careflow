import type { NextRequest } from "next/server";
import { z } from "zod";
import { beginMfaEnrollment, confirmMfaEnrollment } from "../../../../../server/auth/mfa-service";
import {
  getActiveSessionContext,
  isSameOriginRequest,
} from "../../../../../server/auth/session-context";
import { getDb } from "../../../../../server/db/client";
import { getServerEnv } from "../../../../../server/env";
import {
  dataResponse,
  errorResponse,
  internalErrorResponse,
} from "../../../../../server/http/json-response";

const verificationSchema = z.object({ token: z.string().regex(/^\d{6}$/) }).strict();

export async function POST(request: NextRequest): Promise<Response> {
  if (!isSameOriginRequest(request)) return errorResponse("FORBIDDEN", "Request origin is not allowed", 403);
  const session = await getActiveSessionContext(request);
  if (!session) return errorResponse("UNAUTHENTICATED", "Sign in is required", 401);
  if (session.mfaEnrolled) return errorResponse("CONFLICT", "MFA is already enrolled", 409);

  try {
    const enrollment = await beginMfaEnrollment(
      getDb(),
      session.userId,
      getServerEnv().MFA_ENCRYPTION_KEY,
    );
    return dataResponse(enrollment);
  } catch (error) {
    return internalErrorResponse(error);
  }
}

export async function PUT(request: NextRequest): Promise<Response> {
  if (!isSameOriginRequest(request)) return errorResponse("FORBIDDEN", "Request origin is not allowed", 403);
  const session = await getActiveSessionContext(request);
  if (!session) return errorResponse("UNAUTHENTICATED", "Sign in is required", 401);

  const parsed = verificationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("VALIDATION_FAILED", "Enter a valid 6-digit code", 400);

  try {
    const env = getServerEnv();
    const recoveryCodes = await confirmMfaEnrollment(getDb(), {
      userId: session.userId,
      sessionToken: session.sessionToken,
      token: parsed.data.token,
      encryptionKey: env.MFA_ENCRYPTION_KEY,
      recoveryPepper: env.RECOVERY_CODE_PEPPER,
    });
    return dataResponse({ recoveryCodes });
  } catch {
    return errorResponse("INVALID_MFA_CODE", "The verification code is invalid or expired", 400);
  }
}

import type { NextRequest } from "next/server";
import {
  AccountStatus,
  EmploymentStatus,
  type PrismaClient,
} from "../../generated/prisma/client";
import { errorResponse } from "../http/json-response";
import { getDb } from "../db/client";
import { Capability, hasCapability } from "./permissions";
import { readSessionToken } from "./session-context";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const IDLE_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export class AuthorizationError extends Error {
  constructor(
    public readonly code: "UNAUTHENTICATED" | "MFA_ENROLLMENT_REQUIRED" | "MFA_REQUIRED" | "FORBIDDEN",
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

type AuthorizeOptions = {
  db?: PrismaClient;
  now?: Date;
};

export async function authorizeRequest(
  request: NextRequest,
  capability: Capability,
  options: AuthorizeOptions = {},
) {
  const db = options.db ?? getDb();
  const now = options.now ?? new Date();
  const sessionToken = readSessionToken(request);
  if (!sessionToken) throw new AuthorizationError("UNAUTHENTICATED", 401, "Sign in is required");

  const session = await db.session.findUnique({
    where: { sessionToken },
    include: { user: { include: { staffProfile: true } } },
  });
  const idleDeadline = new Date(now.getTime() - IDLE_TIMEOUT_MS);
  const isExpired =
    !session ||
    session.expires.getTime() <= now.getTime() ||
    session.absoluteExpiresAt.getTime() <= now.getTime() ||
    session.lastSeenAt.getTime() <= idleDeadline.getTime();
  if (isExpired) {
    if (session) await db.session.deleteMany({ where: { id: session.id } });
    throw new AuthorizationError("UNAUTHENTICATED", 401, "Sign in is required");
  }

  const profile = session.user.staffProfile;
  if (
    session.user.status !== AccountStatus.ACTIVE ||
    session.user.deletedAt ||
    !profile ||
    profile.employmentStatus !== EmploymentStatus.ACTIVE
  ) {
    throw new AuthorizationError("UNAUTHENTICATED", 401, "Sign in is required");
  }
  if (!session.user.mfaEnrolledAt) {
    throw new AuthorizationError("MFA_ENROLLMENT_REQUIRED", 403, "MFA enrollment is required");
  }
  if (!session.mfaVerifiedAt) {
    throw new AuthorizationError("MFA_REQUIRED", 403, "MFA verification is required");
  }
  if (!hasCapability(profile.role, capability)) {
    throw new AuthorizationError("FORBIDDEN", 403, "You do not have permission for this action");
  }

  if (session.lastSeenAt.getTime() <= now.getTime() - IDLE_TOUCH_INTERVAL_MS) {
    await db.session.updateMany({
      where: { id: session.id, lastSeenAt: session.lastSeenAt },
      data: { lastSeenAt: now },
    });
  }

  return {
    userId: session.userId,
    sessionId: session.id,
    sessionToken,
    role: profile.role,
    employeeNumber: profile.employeeNumber,
    displayName: profile.displayName,
  };
}

export function authorizationErrorResponse(error: AuthorizationError): Response {
  return errorResponse(error.code, error.message, error.status);
}

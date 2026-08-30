import type { NextRequest } from "next/server";
import { AccountStatus, EmploymentStatus } from "../../generated/prisma/client";
import { getDb } from "../db/client";

const SESSION_COOKIE_NAMES = ["__Secure-authjs.session-token", "authjs.session-token"];
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const IDLE_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export function readSessionToken(request: NextRequest): string | null {
  for (const baseName of SESSION_COOKIE_NAMES) {
    const exact = request.cookies.get(baseName)?.value;
    if (exact && exact.length >= 16 && exact.length <= 512) return exact;

    const chunks = request.cookies
      .getAll()
      .filter((cookie) => cookie.name.startsWith(`${baseName}.`))
      .sort((left, right) => {
        const leftIndex = Number(left.name.slice(baseName.length + 1));
        const rightIndex = Number(right.name.slice(baseName.length + 1));
        return leftIndex - rightIndex;
      });
    if (chunks.length > 0) {
      const token = chunks.map((chunk) => chunk.value).join("");
      if (token.length >= 16 && token.length <= 512) return token;
    }
  }
  return null;
}

export function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function getActiveSessionContext(request: NextRequest, now = new Date()) {
  const sessionToken = readSessionToken(request);
  if (!sessionToken) return null;

  const session = await getDb().session.findUnique({
    where: { sessionToken },
    include: { user: { include: { staffProfile: true } } },
  });
  if (
    !session ||
    session.expires.getTime() <= now.getTime() ||
    session.absoluteExpiresAt.getTime() <= now.getTime() ||
    session.lastSeenAt.getTime() <= now.getTime() - IDLE_TIMEOUT_MS ||
    session.user.status !== AccountStatus.ACTIVE ||
    session.user.deletedAt ||
    session.user.staffProfile?.employmentStatus !== EmploymentStatus.ACTIVE
  ) {
    return null;
  }

  if (session.lastSeenAt.getTime() <= now.getTime() - IDLE_TOUCH_INTERVAL_MS) {
    await getDb().session.updateMany({
      where: { id: session.id, lastSeenAt: session.lastSeenAt },
      data: { lastSeenAt: now },
    });
  }

  return {
    userId: session.userId,
    sessionToken,
    role: session.user.staffProfile.role,
    mfaEnrolled: Boolean(session.user.mfaEnrolledAt),
    mfaVerified: Boolean(session.mfaVerifiedAt),
  };
}

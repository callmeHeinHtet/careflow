import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { getDb } from "../db/client";
import { AppError } from "../http/app-error";

type RateLimitOptions = {
  scope: string;
  identifier: string;
  limit: number;
  windowMs: number;
  now?: Date;
};

export function rateLimitKey(scope: string, identifier: string) {
  const label = scope.toLocaleLowerCase("en-US").replace(/[^a-z0-9:-]/g, "-").slice(0, 24);
  const digest = createHash("sha256").update(`${scope}\0${identifier.trim().toLocaleLowerCase("en-US")}`).digest("hex");
  return `${label}:${digest}`;
}

export async function enforceRateLimit(db: PrismaClient, options: RateLimitOptions) {
  const now = options.now ?? new Date();
  const resetBefore = new Date(now.getTime() - options.windowMs);
  const expiresAt = new Date(now.getTime() + options.windowMs * 2);
  const key = rateLimitKey(options.scope, options.identifier);

  const bucket = await db.$transaction(async (tx) => {
    await tx.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: now } } });
    const rows = await tx.$queryRaw<{ count: number; windowStart: Date }[]>(Prisma.sql`
      INSERT INTO "RateLimitBucket" ("key", "windowStart", "count", "expiresAt")
      VALUES (${key}, ${now}, 1, ${expiresAt})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimitBucket"."windowStart" <= ${resetBefore} THEN 1
          ELSE "RateLimitBucket"."count" + 1
        END,
        "windowStart" = CASE
          WHEN "RateLimitBucket"."windowStart" <= ${resetBefore} THEN ${now}
          ELSE "RateLimitBucket"."windowStart"
        END,
        "expiresAt" = ${expiresAt}
      RETURNING "count", "windowStart"
    `);
    return rows[0];
  });

  if (!bucket) throw new Error("Rate limit bucket was not returned");
  if (bucket.count > options.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.windowStart.getTime() + options.windowMs - now.getTime()) / 1000));
    throw new AppError("RATE_LIMITED", "Too many requests. Try again later.", 429, { retryAfterSeconds });
  }
}

export async function enforceMutationRateLimit(request: NextRequest, actorUserId: string, db = getDb()) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "unknown";
  await enforceRateLimit(db, {
    scope: `mutation:${new URL(request.url).pathname}`,
    identifier: `${actorUserId}:${address}`,
    limit: 120,
    windowMs: 60_000,
  });
}

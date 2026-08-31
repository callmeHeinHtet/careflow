import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { AppError } from "./app-error";
import { fingerprintPayload } from "./mutation-request";

const RETENTION_MS = 24 * 60 * 60 * 1000;

type MutationResult<T extends Prisma.InputJsonValue> = {
  status: number;
  body: T;
};

type IdempotentMutationInput<T extends Prisma.InputJsonValue> = {
  actorUserId: string;
  scope: string;
  key: string;
  payload: unknown;
  now?: Date;
  execute: (tx: Prisma.TransactionClient) => Promise<MutationResult<T>>;
};

export async function runIdempotentMutation<T extends Prisma.InputJsonValue>(
  db: PrismaClient,
  input: IdempotentMutationInput<T>,
): Promise<MutationResult<T> & { replayed: boolean }> {
  const requestHash = fingerprintPayload(input.payload);
  const now = input.now ?? new Date();
  const lockIdentity = `${input.actorUserId}:${input.scope}:${input.key}`;

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockIdentity}, 0))::text`;

    const existing = await tx.idempotencyRecord.findUnique({
      where: {
        actorUserId_scope_key: {
          actorUserId: input.actorUserId,
          scope: input.scope,
          key: input.key,
        },
      },
    });

    if (existing && existing.expiresAt.getTime() > now.getTime()) {
      if (existing.requestHash !== requestHash) {
        throw new AppError(
          "IDEMPOTENCY_CONFLICT",
          "This idempotency key was already used for a different request",
          409,
        );
      }
      return {
        status: existing.responseStatus,
        body: existing.responseBody as T,
        replayed: true,
      };
    }

    if (existing) await tx.idempotencyRecord.delete({ where: { id: existing.id } });

    const result = await input.execute(tx);
    await tx.idempotencyRecord.create({
      data: {
        actorUserId: input.actorUserId,
        scope: input.scope,
        key: input.key,
        requestHash,
        responseStatus: result.status,
        responseBody: result.body,
        expiresAt: new Date(now.getTime() + RETENTION_MS),
      },
    });

    return { ...result, replayed: false };
  });
}

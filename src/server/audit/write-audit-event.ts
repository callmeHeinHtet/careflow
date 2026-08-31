import type { Prisma, StaffRole } from "../../generated/prisma/client";

type AuditInput = {
  actorUserId: string | null;
  actorName: string;
  role: StaffRole | string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  correlationId: string;
  ipAddress?: string | null;
};

export async function writeAuditEvent(tx: Prisma.TransactionClient, input: AuditInput) {
  return tx.auditEvent.create({
    data: {
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      roleSnapshot: input.role,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before,
      after: input.after,
      correlationId: input.correlationId,
      ipAddress: input.ipAddress,
    },
  });
}

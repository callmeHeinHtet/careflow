import type { Prisma, PrismaClient, StaffRole } from "../../generated/prisma/client";
import { auditActionsForRole, type AuditQueryInput } from "../validation/audit-query";

type AuditReadInput = AuditQueryInput & {
  actorUserId: string;
  role: StaffRole;
};

export async function listAuditEvents(db: PrismaClient, input: AuditReadInput) {
  const allowedActions = auditActionsForRole(input.role);
  const permissionFilter: Prisma.AuditEventWhereInput | undefined = allowedActions
    ? {
        OR: [
          { actorUserId: input.actorUserId },
          { action: { in: [...allowedActions] } },
        ],
      }
    : undefined;
  const rows = await db.auditEvent.findMany({
    where: {
      AND: [
        ...(permissionFilter ? [permissionFilter] : []),
        ...(input.action ? [{ action: input.action }] : []),
        ...(input.entityType ? [{ entityType: input.entityType }] : []),
        ...(input.entityId ? [{ entityId: input.entityId }] : []),
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    cursor: input.cursor ? { id: input.cursor } : undefined,
    skip: input.cursor ? 1 : 0,
    take: input.limit + 1,
  });
  const hasMore = rows.length > input.limit;
  const page = hasMore ? rows.slice(0, input.limit) : rows;
  return {
    items: page.map((event) => ({
      id: event.id,
      actorUserId: event.actorUserId,
      actorName: event.actorName,
      role: event.roleSnapshot,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      before: event.before,
      after: event.after,
      correlationId: event.correlationId,
      createdAt: event.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
  };
}

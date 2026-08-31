import type { PrismaClient, StaffRole } from "../../generated/prisma/client";
import { writeAuditEvent } from "../audit/write-audit-event";
import { AppError } from "../http/app-error";
import { runIdempotentMutation } from "../http/idempotency";
import { getVisitById } from "../repositories/visit-repository";
import type { TriageInput, VisitPriorityInput } from "../validation/visit-mutations";

type MutationActor = {
  userId: string;
  displayName: string;
  role: StaffRole;
  correlationId: string;
  ipAddress: string | null;
};

export function updateVisitPriority(
  db: PrismaClient,
  visitId: string,
  input: VisitPriorityInput,
  actor: MutationActor,
  idempotencyKey: string,
) {
  return runIdempotentMutation(db, {
    actorUserId: actor.userId,
    scope: `visits.${visitId}.priority`,
    key: idempotencyKey,
    payload: input,
    execute: async (tx) => {
      const current = await tx.visit.findUnique({ where: { id: visitId } });
      if (!current) throw new AppError("NOT_FOUND", "Visit not found", 404);
      if (current.version !== input.version) {
        throw new AppError("CONFLICT", "The visit changed", 409, {
          currentVersion: current.version,
        });
      }
      if (current.stage !== "WAITING" && current.stage !== "TRIAGE") {
        throw new AppError("CONFLICT", "Queue priority cannot be changed at this stage", 409, {
          currentStage: current.stage,
          currentVersion: current.version,
        });
      }

      const changed = await tx.visit.updateMany({
        where: { id: visitId, version: input.version, stage: { in: ["WAITING", "TRIAGE"] } },
        data: { priority: input.priority, version: { increment: 1 } },
      });
      if (changed.count !== 1) {
        const latest = await tx.visit.findUnique({ where: { id: visitId } });
        throw new AppError("CONFLICT", "The visit changed", 409, {
          currentStage: latest?.stage,
          currentVersion: latest?.version,
        });
      }

      const visit = await getVisitById(tx, visitId);
      if (!visit) throw new AppError("NOT_FOUND", "Visit not found", 404);
      await writeAuditEvent(tx, {
        actorUserId: actor.userId,
        actorName: actor.displayName,
        role: actor.role,
        action: "VISIT_PRIORITY_UPDATED",
        entityType: "Visit",
        entityId: visitId,
        before: { priority: current.priority, version: current.version },
        after: { priority: visit.priority, version: visit.version },
        correlationId: actor.correlationId,
        ipAddress: actor.ipAddress,
      });
      return { status: 200, body: { data: { visit } } };
    },
  });
}

export function recordTriage(
  db: PrismaClient,
  visitId: string,
  input: TriageInput,
  actor: MutationActor,
  idempotencyKey: string,
) {
  return runIdempotentMutation(db, {
    actorUserId: actor.userId,
    scope: `visits.${visitId}.triage`,
    key: idempotencyKey,
    payload: input,
    execute: async (tx) => {
      const current = await tx.visit.findUnique({
        where: { id: visitId },
        include: { triage: true },
      });
      if (!current) throw new AppError("NOT_FOUND", "Visit not found", 404);
      if (current.version !== input.version) {
        throw new AppError("CONFLICT", "The visit changed", 409, {
          currentVersion: current.version,
        });
      }
      if (
        (current.stage !== "WAITING" && current.stage !== "TRIAGE") ||
        current.triage
      ) {
        throw new AppError("CONFLICT", "Triage cannot be recorded at this stage", 409, {
          currentStage: current.stage,
          currentVersion: current.version,
        });
      }

      const changed = await tx.visit.updateMany({
        where: {
          id: visitId,
          version: input.version,
          stage: { in: ["WAITING", "TRIAGE"] },
          triage: null,
        },
        data: {
          stage: "CONSULTATION",
          priority: input.priority,
          symptoms: input.symptoms,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) {
        const latest = await tx.visit.findUnique({ where: { id: visitId } });
        throw new AppError("CONFLICT", "The visit changed", 409, {
          currentStage: latest?.stage,
          currentVersion: latest?.version,
        });
      }

      await tx.triageObservation.create({
        data: {
          visitId,
          temperature: input.temperature,
          bloodPressure: input.bloodPressure,
          heartRate: input.heartRate,
          oxygenSat: input.oxygenSat,
          notes: input.notes,
          authorUserId: actor.userId,
        },
      });
      const visit = await getVisitById(tx, visitId);
      if (!visit) throw new AppError("NOT_FOUND", "Visit not found", 404);
      await writeAuditEvent(tx, {
        actorUserId: actor.userId,
        actorName: actor.displayName,
        role: actor.role,
        action: "TRIAGE_RECORDED",
        entityType: "Visit",
        entityId: visitId,
        before: { stage: current.stage, priority: current.priority, version: current.version },
        after: { stage: visit.stage, priority: visit.priority, version: visit.version },
        correlationId: actor.correlationId,
        ipAddress: actor.ipAddress,
      });
      return { status: 200, body: { data: { visit } } };
    },
  });
}

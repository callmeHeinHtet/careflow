import type { PrismaClient, StaffRole } from "../../generated/prisma/client";
import { writeAuditEvent } from "../audit/write-audit-event";
import { AppError } from "../http/app-error";
import { runIdempotentMutation } from "../http/idempotency";
import { getVisitById } from "../repositories/visit-repository";
import { decimalToNumber } from "../serializers/patient";
import type { ConsultationInput } from "../validation/consultation";

type MutationActor = {
  userId: string;
  displayName: string;
  role: StaffRole;
  correlationId: string;
  ipAddress: string | null;
};

export function completeConsultation(
  db: PrismaClient,
  visitId: string,
  input: ConsultationInput,
  actor: MutationActor,
  idempotencyKey: string,
) {
  return runIdempotentMutation(db, {
    actorUserId: actor.userId,
    scope: `visits.${visitId}.consultation`,
    key: idempotencyKey,
    payload: input,
    execute: async (tx) => {
      const current = await tx.visit.findUnique({
        where: { id: visitId },
        include: { consultation: true, invoice: true },
      });
      if (!current) throw new AppError("NOT_FOUND", "Visit not found", 404);
      if (current.version !== input.version) {
        throw new AppError("CONFLICT", "The visit changed", 409, {
          currentVersion: current.version,
        });
      }
      if (current.stage !== "CONSULTATION" || current.consultation || current.invoice) {
        throw new AppError("CONFLICT", "Consultation cannot be completed at this stage", 409, {
          currentStage: current.stage,
          currentVersion: current.version,
        });
      }

      const consultationServices = await tx.clinicalService.findMany({
        where: {
          type: "CONSULTATION",
          active: true,
          OR: [{ departmentId: current.departmentId }, { departmentId: null }],
        },
      });
      const consultationService =
        consultationServices.find((service) => service.departmentId === current.departmentId) ??
        consultationServices.find((service) => service.departmentId === null);
      if (!consultationService) {
        throw new AppError("VALIDATION_FAILED", "No active consultation service is configured", 400);
      }

      const [labServices, medications] = await Promise.all([
        tx.clinicalService.findMany({
          where: { id: { in: input.labServiceIds }, type: "LAB", active: true },
        }),
        tx.medication.findMany({
          where: {
            id: { in: input.prescriptions.map((item) => item.medicationId) },
            active: true,
          },
        }),
      ]);
      if (labServices.length !== input.labServiceIds.length) {
        throw new AppError("VALIDATION_FAILED", "One or more lab services are unavailable", 400);
      }
      if (medications.length !== input.prescriptions.length) {
        throw new AppError("VALIDATION_FAILED", "One or more medications are unavailable", 400);
      }

      const medicationById = new Map(medications.map((medication) => [medication.id, medication]));
      const consultationPrice = decimalToNumber(consultationService.unitPrice);
      const labTotal = labServices.reduce(
        (sum, service) => sum + decimalToNumber(service.unitPrice),
        0,
      );
      const medicationTotal = input.prescriptions.reduce((sum, prescription) => {
        const medication = medicationById.get(prescription.medicationId)!;
        return sum + decimalToNumber(medication.unitPrice) * prescription.quantity;
      }, 0);
      const total = consultationPrice + labTotal + medicationTotal;
      const nextStage = input.prescriptions.length ? "PHARMACY" : "BILLING";

      const changed = await tx.visit.updateMany({
        where: { id: visitId, version: input.version, stage: "CONSULTATION" },
        data: { stage: nextStage, version: { increment: 1 } },
      });
      if (changed.count !== 1) {
        const latest = await tx.visit.findUnique({ where: { id: visitId } });
        throw new AppError("CONFLICT", "The visit changed", 409, {
          currentStage: latest?.stage,
          currentVersion: latest?.version,
        });
      }

      const consultation = await tx.consultation.create({
        data: {
          visitId,
          findings: input.findings,
          diagnosis: input.diagnosis,
          followUp: input.followUp ?? null,
          authorUserId: actor.userId,
        },
      });
      if (labServices.length) {
        await tx.labOrder.createMany({
          data: labServices.map((service) => ({
            visitId,
            name: service.name,
            orderedById: actor.userId,
          })),
        });
      }
      if (input.prescriptions.length) {
        await tx.prescription.createMany({
          data: input.prescriptions.map((prescription) => ({
            visitId,
            consultationId: consultation.id,
            medicationId: prescription.medicationId,
            quantity: prescription.quantity,
            directions: prescription.directions,
            orderedByUserId: actor.userId,
          })),
        });
      }

      await tx.invoice.create({
        data: {
          visitId,
          status: input.prescriptions.length ? "DRAFT" : "UNPAID",
          subtotal: total,
          total,
          lines: {
            create: [
              {
                type: "CONSULTATION",
                description: consultationService.name,
                quantity: 1,
                unitPrice: consultationPrice,
                total: consultationPrice,
              },
              ...labServices.map((service) => ({
                type: "LAB" as const,
                description: service.name,
                quantity: 1,
                unitPrice: decimalToNumber(service.unitPrice),
                total: decimalToNumber(service.unitPrice),
              })),
              ...input.prescriptions.map((prescription) => {
                const medication = medicationById.get(prescription.medicationId)!;
                const unitPrice = decimalToNumber(medication.unitPrice);
                return {
                  type: "MEDICATION" as const,
                  description: `${medication.name} ${medication.strength}`,
                  quantity: prescription.quantity,
                  unitPrice,
                  total: unitPrice * prescription.quantity,
                };
              }),
            ],
          },
        },
      });

      const visit = await getVisitById(tx, visitId);
      if (!visit) throw new AppError("NOT_FOUND", "Visit not found", 404);
      await writeAuditEvent(tx, {
        actorUserId: actor.userId,
        actorName: actor.displayName,
        role: actor.role,
        action: "CONSULTATION_COMPLETED",
        entityType: "Visit",
        entityId: visitId,
        before: { stage: current.stage, version: current.version },
        after: {
          stage: visit.stage,
          version: visit.version,
          labOrderCount: input.labServiceIds.length,
          prescriptionCount: input.prescriptions.length,
          invoiceId: visit.invoice?.id,
        },
        correlationId: actor.correlationId,
        ipAddress: actor.ipAddress,
      });
      return { status: 200, body: { data: { visit } } };
    },
  });
}

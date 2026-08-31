import { randomUUID } from "node:crypto";
import type { PrismaClient, StaffRole } from "../../generated/prisma/client";
import { writeAuditEvent } from "../audit/write-audit-event";
import { AppError } from "../http/app-error";
import { runIdempotentMutation } from "../http/idempotency";
import { getVisitById } from "../repositories/visit-repository";
import type { DispenseInput, PaymentInput } from "../validation/fulfillment";

type MutationActor = {
  userId: string;
  displayName: string;
  role: StaffRole;
  correlationId: string;
  ipAddress: string | null;
};

type LockedLot = {
  id: string;
  quantityOnHand: number;
};

const normalize = (value: string) => value.trim().toLocaleLowerCase("en-US");

export function dispensePrescription(
  db: PrismaClient,
  visitId: string,
  input: DispenseInput,
  actor: MutationActor,
  idempotencyKey: string,
) {
  return runIdempotentMutation(db, {
    actorUserId: actor.userId,
    scope: `visits.${visitId}.dispense`,
    key: idempotencyKey,
    payload: input,
    execute: async (tx) => {
      const current = await tx.visit.findUnique({
        where: { id: visitId },
        include: {
          patient: { include: { allergies: true } },
          invoice: true,
          prescriptions: {
            where: { id: input.prescriptionId },
            include: { medication: true },
          },
        },
      });
      if (!current) throw new AppError("NOT_FOUND", "Visit not found", 404);
      if (current.version !== input.version) {
        throw new AppError("CONFLICT", "The visit changed", 409, {
          currentVersion: current.version,
        });
      }
      if (current.stage !== "PHARMACY" || !current.invoice) {
        throw new AppError("CONFLICT", "Medication cannot be dispensed at this stage", 409, {
          currentStage: current.stage,
          currentVersion: current.version,
        });
      }
      const prescription = current.prescriptions[0];
      if (!prescription || prescription.status !== "ORDERED") {
        throw new AppError("CONFLICT", "The prescription is not awaiting dispensing", 409);
      }
      const allergyTerms = new Set(current.patient.allergies.map((allergy) => normalize(allergy.substance)));
      if (
        allergyTerms.has(normalize(prescription.medication.name)) ||
        allergyTerms.has(normalize(prescription.medication.code))
      ) {
        throw new AppError(
          "ALLERGY_CONFLICT",
          "Dispensing is blocked by an exact medication allergy record",
          409,
        );
      }

      const claimed = await tx.visit.updateMany({
        where: { id: visitId, version: input.version, stage: "PHARMACY" },
        data: { version: { increment: 1 } },
      });
      if (claimed.count !== 1) {
        const latest = await tx.visit.findUnique({ where: { id: visitId } });
        throw new AppError("CONFLICT", "The visit changed", 409, {
          currentStage: latest?.stage,
          currentVersion: latest?.version,
        });
      }

      const lots = await tx.$queryRaw<LockedLot[]>`
        SELECT "id", "quantityOnHand"
        FROM "InventoryLot"
        WHERE "medicationId" = ${prescription.medicationId}::uuid
          AND "expiresAt" >= CURRENT_DATE
          AND "quantityOnHand" > 0
        ORDER BY "expiresAt" ASC, "createdAt" ASC, "id" ASC
        FOR UPDATE
      `;
      const available = lots.reduce((sum, lot) => sum + lot.quantityOnHand, 0);
      if (available < prescription.quantity) {
        throw new AppError("INSUFFICIENT_STOCK", "There is not enough unexpired stock", 409, {
          available,
          required: prescription.quantity,
        });
      }

      let remaining = prescription.quantity;
      for (const lot of lots) {
        if (remaining === 0) break;
        const quantity = Math.min(remaining, lot.quantityOnHand);
        await tx.inventoryLot.update({
          where: { id: lot.id },
          data: { quantityOnHand: { decrement: quantity } },
        });
        await tx.inventoryTransaction.create({
          data: {
            medicationId: prescription.medicationId,
            lotId: lot.id,
            prescriptionId: prescription.id,
            type: "DISPENSE",
            quantity: -quantity,
            notes: "Dispensed against prescription",
            actorUserId: actor.userId,
          },
        });
        remaining -= quantity;
      }

      const dispensed = await tx.prescription.updateMany({
        where: { id: prescription.id, visitId, status: "ORDERED" },
        data: {
          status: "DISPENSED",
          dispensedByUserId: actor.userId,
          dispensedAt: new Date(),
        },
      });
      if (dispensed.count !== 1) {
        throw new AppError("CONFLICT", "The prescription changed", 409);
      }

      const outstanding = await tx.prescription.count({
        where: { visitId, status: "ORDERED" },
      });
      if (outstanding === 0) {
        await tx.visit.update({ where: { id: visitId }, data: { stage: "BILLING" } });
        await tx.invoice.update({
          where: { id: current.invoice.id },
          data: { status: "UNPAID", version: { increment: 1 } },
        });
      }

      const visit = await getVisitById(tx, visitId);
      if (!visit) throw new AppError("NOT_FOUND", "Visit not found", 404);
      await writeAuditEvent(tx, {
        actorUserId: actor.userId,
        actorName: actor.displayName,
        role: actor.role,
        action: "PRESCRIPTION_DISPENSED",
        entityType: "Prescription",
        entityId: prescription.id,
        before: { status: prescription.status, visitStage: current.stage, visitVersion: current.version },
        after: {
          status: "DISPENSED",
          quantity: prescription.quantity,
          visitStage: visit.stage,
          visitVersion: visit.version,
        },
        correlationId: actor.correlationId,
        ipAddress: actor.ipAddress,
      });
      return { status: 200, body: { data: { visit } } };
    },
  });
}

export function settleVisitInvoice(
  db: PrismaClient,
  visitId: string,
  input: PaymentInput,
  actor: MutationActor,
  idempotencyKey: string,
) {
  return runIdempotentMutation(db, {
    actorUserId: actor.userId,
    scope: `visits.${visitId}.payment`,
    key: idempotencyKey,
    payload: input,
    execute: async (tx) => {
      const current = await tx.visit.findUnique({
        where: { id: visitId },
        include: { invoice: { include: { payments: true } } },
      });
      if (!current || !current.invoice) throw new AppError("NOT_FOUND", "Invoice not found", 404);
      if (current.version !== input.visitVersion || current.invoice.version !== input.invoiceVersion) {
        throw new AppError("CONFLICT", "The visit or invoice changed", 409, {
          currentVisitVersion: current.version,
          currentInvoiceVersion: current.invoice.version,
        });
      }
      if (
        current.stage !== "BILLING" ||
        current.invoice.status !== "UNPAID" ||
        current.invoice.payments.some((payment) => payment.status === "COMPLETED")
      ) {
        throw new AppError("CONFLICT", "The invoice is not awaiting payment", 409, {
          currentStage: current.stage,
          invoiceStatus: current.invoice.status,
        });
      }
      if (input.reference) {
        const duplicate = await tx.payment.findUnique({ where: { reference: input.reference } });
        if (duplicate) throw new AppError("CONFLICT", "The payment reference is already in use", 409);
      }

      const visitUpdated = await tx.visit.updateMany({
        where: { id: visitId, version: input.visitVersion, stage: "BILLING" },
        data: { stage: "DISCHARGED", dischargedAt: new Date(), version: { increment: 1 } },
      });
      const invoiceUpdated = await tx.invoice.updateMany({
        where: { id: current.invoice.id, version: input.invoiceVersion, status: "UNPAID" },
        data: { status: "PAID", version: { increment: 1 } },
      });
      if (visitUpdated.count !== 1 || invoiceUpdated.count !== 1) {
        throw new AppError("CONFLICT", "The visit or invoice changed", 409);
      }

      const payment = await tx.payment.create({
        data: {
          invoiceId: current.invoice.id,
          amount: current.invoice.total,
          method: input.method,
          status: "COMPLETED",
          reference: input.reference ?? `CFPAY-${randomUUID()}`,
          cashierUserId: actor.userId,
          paidAt: new Date(),
        },
      });
      const visit = await getVisitById(tx, visitId);
      if (!visit) throw new AppError("NOT_FOUND", "Visit not found", 404);
      await writeAuditEvent(tx, {
        actorUserId: actor.userId,
        actorName: actor.displayName,
        role: actor.role,
        action: "INVOICE_SETTLED",
        entityType: "Invoice",
        entityId: current.invoice.id,
        before: {
          invoiceStatus: current.invoice.status,
          invoiceVersion: current.invoice.version,
          visitStage: current.stage,
          visitVersion: current.version,
        },
        after: {
          invoiceStatus: "PAID",
          visitStage: visit.stage,
          visitVersion: visit.version,
          paymentId: payment.id,
          method: payment.method,
        },
        correlationId: actor.correlationId,
        ipAddress: actor.ipAddress,
      });
      return { status: 200, body: { data: { visit } } };
    },
  });
}

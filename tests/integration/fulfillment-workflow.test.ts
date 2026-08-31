import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { seedCareFlow } from "../../prisma/seed";
import { disconnectDb } from "../../src/server/db/client";
import { createTestDb, resetTestDb } from "../../src/server/db/reset-test-db";
import { dispensePrescription, settleVisitInvoice } from "../../src/server/services/fulfillment-service";

const db = createTestDb();
const pharmacy = {
  userId: "90000000-0000-4000-8000-000000000004",
  displayName: "Thiri Moe",
  role: "PHARMACY" as const,
  correlationId: "7a9babf7-66ac-4d55-ae47-a1f79df0a08a",
  ipAddress: "127.0.0.1",
};
const cashier = {
  userId: "90000000-0000-4000-8000-000000000005",
  displayName: "Min Thu",
  role: "CASHIER" as const,
  correlationId: "f95796b6-bd7a-4fb9-bd3b-e8514712ade4",
  ipAddress: "127.0.0.1",
};

beforeEach(async () => {
  await resetTestDb(db);
  await seedCareFlow(db);
});

afterAll(async () => {
  await db.$disconnect();
  await disconnectDb();
});

describe("dispensing and payment workflows", () => {
  it("dispenses from earliest-expiring lots and moves the final prescription to billing", async () => {
    const visit = await db.visit.findUniqueOrThrow({ where: { queueToken: "OPD-017" } });
    const prescription = await db.prescription.findFirstOrThrow({ where: { visitId: visit.id } });
    const existingLot = await db.inventoryLot.findFirstOrThrow({ where: { medicationId: prescription.medicationId } });
    await db.inventoryLot.update({ where: { id: existingLot.id }, data: { quantityOnHand: 7 } });
    const earlyLot = await db.inventoryLot.create({
      data: {
        medicationId: prescription.medicationId,
        batchNumber: "EARLY-BATCH",
        expiresAt: new Date("2026-09-01T00:00:00.000Z"),
        quantityOnHand: 3,
      },
    });

    const result = await dispensePrescription(
      db,
      visit.id,
      { version: 1, prescriptionId: prescription.id },
      pharmacy,
      "dispense_prescription_0001",
    );

    expect(result.body.data.visit).toMatchObject({ stage: "BILLING", version: 2 });
    expect((await db.inventoryLot.findUniqueOrThrow({ where: { id: earlyLot.id } })).quantityOnHand).toBe(0);
    expect((await db.inventoryLot.findUniqueOrThrow({ where: { id: existingLot.id } })).quantityOnHand).toBe(0);
    expect(await db.inventoryTransaction.aggregate({
      where: { prescriptionId: prescription.id, type: "DISPENSE" },
      _sum: { quantity: true },
    })).toMatchObject({ _sum: { quantity: -10 } });
    expect(await db.auditEvent.count({ where: { action: "PRESCRIPTION_DISPENSED" } })).toBe(1);
  });

  it("rolls back when stock is insufficient", async () => {
    const visit = await db.visit.findUniqueOrThrow({ where: { queueToken: "OPD-017" } });
    const prescription = await db.prescription.findFirstOrThrow({ where: { visitId: visit.id } });
    await db.inventoryLot.updateMany({
      where: { medicationId: prescription.medicationId },
      data: { quantityOnHand: 2 },
    });

    await expect(
      dispensePrescription(
        db,
        visit.id,
        { version: 1, prescriptionId: prescription.id },
        pharmacy,
        "dispense_prescription_0002",
      ),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect((await db.visit.findUniqueOrThrow({ where: { id: visit.id } })).stage).toBe("PHARMACY");
    expect((await db.prescription.findUniqueOrThrow({ where: { id: prescription.id } })).status).toBe("ORDERED");
  });

  it("allows only one concurrent dispense for the same visit version", async () => {
    const visit = await db.visit.findUniqueOrThrow({ where: { queueToken: "OPD-017" } });
    const prescription = await db.prescription.findFirstOrThrow({ where: { visitId: visit.id } });
    const attempts = await Promise.allSettled([
      dispensePrescription(
        db,
        visit.id,
        { version: 1, prescriptionId: prescription.id },
        pharmacy,
        "dispense_concurrent_0001",
      ),
      dispensePrescription(
        db,
        visit.id,
        { version: 1, prescriptionId: prescription.id },
        pharmacy,
        "dispense_concurrent_0002",
      ),
    ]);

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
    expect(await db.inventoryTransaction.aggregate({
      where: { prescriptionId: prescription.id, type: "DISPENSE" },
      _sum: { quantity: true },
    })).toMatchObject({ _sum: { quantity: -10 } });
  });

  it("blocks an exact recorded medication allergy without inferring clinical relationships", async () => {
    const visit = await db.visit.findUniqueOrThrow({ where: { queueToken: "OPD-017" } });
    const prescription = await db.prescription.findFirstOrThrow({
      where: { visitId: visit.id },
      include: { medication: true },
    });
    await db.patientAllergy.create({
      data: { patientId: visit.patientId, substance: prescription.medication.name },
    });
    await expect(
      dispensePrescription(
        db,
        visit.id,
        { version: 1, prescriptionId: prescription.id },
        pharmacy,
        "dispense_prescription_0003",
      ),
    ).rejects.toMatchObject({ code: "ALLERGY_CONFLICT" });
  });

  it("settles the persisted invoice total and discharges atomically", async () => {
    const visit = await db.visit.findUniqueOrThrow({
      where: { queueToken: "OPD-016" },
      include: { invoice: true },
    });
    const result = await settleVisitInvoice(
      db,
      visit.id,
      { visitVersion: 1, invoiceVersion: 1, method: "CASH", reference: "RECEIPT-001" },
      cashier,
      "settle_invoice_0001",
    );

    expect(result.body.data.visit).toMatchObject({
      stage: "DISCHARGED",
      version: 2,
      invoice: { status: "PAID", total: 24000 },
    });
    const payment = await db.payment.findFirstOrThrow({ where: { invoiceId: visit.invoice!.id } });
    expect(payment.amount.toNumber()).toBe(24000);
    expect(payment.status).toBe("COMPLETED");
    expect(await db.auditEvent.count({ where: { action: "INVOICE_SETTLED" } })).toBe(1);
  });

  it("allows only one concurrent payment for the same invoice version", async () => {
    const visit = await db.visit.findUniqueOrThrow({ where: { queueToken: "OPD-016" } });
    const attempts = await Promise.allSettled([
      settleVisitInvoice(
        db,
        visit.id,
        { visitVersion: 1, invoiceVersion: 1, method: "CASH", reference: "CONCURRENT-001" },
        cashier,
        "payment_concurrent_0001",
      ),
      settleVisitInvoice(
        db,
        visit.id,
        { visitVersion: 1, invoiceVersion: 1, method: "CARD", reference: "CONCURRENT-002" },
        cashier,
        "payment_concurrent_0002",
      ),
    ]);
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
    expect(await db.payment.count({ where: { invoice: { visitId: visit.id } } })).toBe(1);
  });
});

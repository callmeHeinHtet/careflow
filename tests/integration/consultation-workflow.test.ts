import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { seedCareFlow } from "../../prisma/seed";
import { disconnectDb } from "../../src/server/db/client";
import { createTestDb, resetTestDb } from "../../src/server/db/reset-test-db";
import { getConsultationCatalog } from "../../src/server/repositories/consultation-catalog-repository";
import { completeConsultation } from "../../src/server/services/consultation-service";

const db = createTestDb();
const doctor = {
  userId: "90000000-0000-4000-8000-000000000003",
  displayName: "Dr. Aye Min",
  role: "DOCTOR" as const,
  correlationId: "b23df6c8-c753-481f-b79e-37110154c531",
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

async function readyVisit() {
  return db.visit.update({
    where: { queueToken: "OPD-018" },
    data: { stage: "CONSULTATION" },
  });
}

describe("consultation workflow", () => {
  it("returns only active persisted clinical services and medications", async () => {
    const catalog = await getConsultationCatalog(db);
    expect(catalog.consultationServices).toHaveLength(1);
    expect(catalog.labServices).toHaveLength(3);
    expect(catalog.medications).toHaveLength(4);
    expect(catalog.consultationServices[0]).toMatchObject({ code: "CONSULT-GENERAL", unitPrice: 15000 });
  });

  it("persists consultation, orders, server-priced invoice, transition, and audit atomically", async () => {
    const visit = await readyVisit();
    const cbc = await db.clinicalService.findUniqueOrThrow({ where: { code: "LAB-CBC" } });
    const paracetamol = await db.medication.findUniqueOrThrow({ where: { code: "MED-PARA-500" } });

    const result = await completeConsultation(
      db,
      visit.id,
      {
        version: 1,
        findings: "Patient examined; findings recorded by clinician.",
        diagnosis: "Clinician-entered assessment",
        followUp: "Review in seven days",
        labServiceIds: [cbc.id],
        prescriptions: [
          { medicationId: paracetamol.id, quantity: 4, directions: "One tablet as directed" },
        ],
      },
      doctor,
      "consultation_complete_0001",
    );

    expect(result.body.data.visit).toMatchObject({ stage: "PHARMACY", version: 2 });
    expect(result.body.data.visit.invoice).toMatchObject({ status: "DRAFT", total: 24000 });
    expect(await db.consultation.count({ where: { visitId: visit.id } })).toBe(1);
    expect(await db.labOrder.count({ where: { visitId: visit.id } })).toBe(1);
    expect(await db.prescription.count({ where: { visitId: visit.id } })).toBe(1);
    expect(await db.auditEvent.count({ where: { action: "CONSULTATION_COMPLETED" } })).toBe(1);
  });

  it("moves directly to billing with an unpaid invoice when no medication is ordered", async () => {
    const visit = await readyVisit();
    const result = await completeConsultation(
      db,
      visit.id,
      {
        version: 1,
        findings: "Patient examined.",
        diagnosis: "Clinician-entered assessment",
        followUp: null,
        labServiceIds: [],
        prescriptions: [],
      },
      doctor,
      "consultation_complete_0002",
    );
    expect(result.body.data.visit).toMatchObject({
      stage: "BILLING",
      invoice: { status: "UNPAID", total: 15000 },
    });
  });

  it("rejects inactive order items and stale versions without partial writes", async () => {
    const visit = await readyVisit();
    const medicine = await db.medication.findUniqueOrThrow({ where: { code: "MED-PARA-500" } });
    await db.medication.update({ where: { id: medicine.id }, data: { active: false } });

    await expect(
      completeConsultation(
        db,
        visit.id,
        {
          version: 1,
          findings: "Patient examined.",
          diagnosis: "Clinician-entered assessment",
          followUp: null,
          labServiceIds: [],
          prescriptions: [{ medicationId: medicine.id, quantity: 1, directions: "As directed" }],
        },
        doctor,
        "consultation_complete_0003",
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(await db.consultation.count({ where: { visitId: visit.id } })).toBe(0);
    expect(await db.invoice.count({ where: { visitId: visit.id } })).toBe(0);
  });
});

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { seedCareFlow } from "../../prisma/seed";
import { createTestDb, resetTestDb } from "../../src/server/db/reset-test-db";

const db = createTestDb();

beforeEach(async () => resetTestDb(db));
afterAll(async () => db.$disconnect());

const expectedNames = [
  "Aung Ko Ko",
  "Ei Ei Win",
  "Ko Min Htet",
  "May Thiri Aung",
  "Nandar Moe",
  "Su Su Lwin",
  "Thant Zin",
  "U Hla Tun",
];

describe("CareFlow fictional seed", () => {
  it("is repeatable and produces the exact operational baseline", async () => {
    await seedCareFlow(db);
    await seedCareFlow(db);

    const [departments, patients, visits, medications, lots, invoices, auditEvents] =
      await Promise.all([
        db.department.count(),
        db.patient.count(),
        db.visit.count(),
        db.medication.count(),
        db.inventoryLot.count(),
        db.invoice.count(),
        db.auditEvent.count(),
      ]);

    expect({ departments, patients, visits, medications, lots, invoices, auditEvents }).toEqual({
      departments: 6,
      patients: 8,
      visits: 8,
      medications: 4,
      lots: 4,
      invoices: 3,
      auditEvents: 3,
    });
  });

  it("contains only the documented fictional patient set", async () => {
    await seedCareFlow(db);
    const patients = await db.patient.findMany({ orderBy: [{ firstName: "asc" }] });
    const names = patients.map((patient) => `${patient.firstName} ${patient.lastName}`.trim()).sort();

    expect(names).toEqual(expectedNames);
    expect(new Set(patients.map((patient) => patient.medicalRecordNumber)).size).toBe(8);
    expect(new Set(patients.map((patient) => patient.phone))).toEqual(
      new Set(["09 420 555 010"]),
    );
  });
});

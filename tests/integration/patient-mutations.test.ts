import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { seedCareFlow } from "../../prisma/seed";
import { disconnectDb } from "../../src/server/db/client";
import { createTestDb, resetTestDb } from "../../src/server/db/reset-test-db";
import {
  registerPatient,
  updatePatientDemographics,
} from "../../src/server/services/patient-service";

const db = createTestDb();
const actor = {
  userId: "90000000-0000-4000-8000-000000000006",
  displayName: "CareFlow Admin",
  role: "ADMIN" as const,
  correlationId: "ef4c70fe-a499-469f-8c68-91f543dfed59",
  ipAddress: "127.0.0.1",
};

const registration = {
  firstName: "Mya",
  lastName: "Win",
  dateOfBirth: "1994-05-17",
  sex: "F" as const,
  phone: "+95 9 420 555 123",
  address: "Yangon",
  allergies: [{ substance: "Penicillin", notes: "Rash" }],
  departmentId: "10000000-0000-4000-8000-000000000001",
  symptoms: "Persistent fever",
  priority: "SOON" as const,
};

beforeEach(async () => {
  await resetTestDb(db);
  await seedCareFlow(db);
});

afterAll(async () => {
  await db.$disconnect();
  await disconnectDb();
});

describe("patient mutation services", () => {
  it("registers the patient, waiting visit, allergy, audit, and idempotency record atomically", async () => {
    const first = await registerPatient(db, registration, actor, "register_patient_0001");
    const replay = await registerPatient(db, registration, actor, "register_patient_0001");

    expect(first.replayed).toBe(false);
    expect(replay).toMatchObject({ replayed: true, body: first.body });
    expect(first.body.data.patient.medicalRecordNumber).toMatch(/^MRN-\d{6}$/);
    expect(first.body.data.visit).toMatchObject({ stage: "WAITING", version: 1 });
    expect(first.body.data.visit.queueToken).toMatch(/^OPD-\d{3,}$/);
    expect(await db.patient.count()).toBe(9);
    expect(await db.patientAllergy.count()).toBe(3);
    expect(await db.auditEvent.count({ where: { action: "PATIENT_REGISTERED" } })).toBe(1);
  });

  it("rolls back every record when the department is unavailable", async () => {
    await expect(
      registerPatient(
        db,
        { ...registration, departmentId: "10000000-0000-4000-8000-000000000099" },
        actor,
        "register_patient_0002",
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    expect(await db.patient.count()).toBe(8);
    expect(await db.idempotencyRecord.count()).toBe(0);
    expect(await db.auditEvent.count()).toBe(3);
  });

  it("updates demographics with optimistic versioning and an audit event", async () => {
    const patient = await db.patient.findUniqueOrThrow({ where: { medicalRecordNumber: "MRN-1001" } });
    const result = await updatePatientDemographics(
      db,
      patient.id,
      { version: 1, phone: "09 777 888 999", allergies: [{ substance: "Latex" }] },
      actor,
      "update_patient_0001",
    );

    expect(result.body.data.patient).toMatchObject({ version: 2, phone: "09 777 888 999" });
    expect(result.body.data.patient.allergies).toEqual(["Latex"]);
    expect(await db.auditEvent.count({ where: { action: "PATIENT_DEMOGRAPHICS_UPDATED" } })).toBe(1);

    await expect(
      updatePatientDemographics(
        db,
        patient.id,
        { version: 1, phone: "09 000 000 000" },
        actor,
        "update_patient_0002",
      ),
    ).rejects.toMatchObject({ code: "CONFLICT", details: { currentVersion: 2 } });
  });
});

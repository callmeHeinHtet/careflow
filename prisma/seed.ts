import { pathToFileURL } from "node:url";
import {
  InventoryTransactionType,
  InvoiceLineType,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  PrescriptionStatus,
  Priority,
  Sex,
  StaffRole,
  VisitStage,
  type PrismaClient,
} from "../src/generated/prisma/client";
import { disconnectDb, getDb } from "../src/server/db/client";

const ids = {
  departments: [1, 2, 3, 4, 5, 6].map((value) =>
    `10000000-0000-4000-8000-${String(value).padStart(12, "0")}`,
  ),
  patients: [1, 2, 3, 4, 5, 6, 7, 8].map((value) =>
    `20000000-0000-4000-8000-${String(value).padStart(12, "0")}`,
  ),
  visits: [1, 2, 3, 4, 5, 6, 7, 8].map((value) =>
    `30000000-0000-4000-8000-${String(value).padStart(12, "0")}`,
  ),
  medications: [1, 2, 3, 4].map((value) =>
    `40000000-0000-4000-8000-${String(value).padStart(12, "0")}`,
  ),
  lots: [1, 2, 3, 4].map((value) =>
    `50000000-0000-4000-8000-${String(value).padStart(12, "0")}`,
  ),
  users: [1, 2, 3, 4, 5, 6].map((value) =>
    `90000000-0000-4000-8000-${String(value).padStart(12, "0")}`,
  ),
};

const departments = [
  ["GEN", "General Medicine", 4],
  ["PED", "Pediatrics", 3],
  ["ORT", "Orthopedics", 3],
  ["CAR", "Cardiology", 2],
  ["DER", "Dermatology", 2],
  ["ENT", "ENT", 2],
] as const;

const patients = [
  { mrn: "MRN-1001", first: "May Thiri", last: "Aung", dob: "1997-04-12", sex: Sex.F, token: "OPD-018", department: 0, stage: VisitStage.WAITING, priority: Priority.URGENT, symptoms: "Fever and fatigue", arrival: "08:12", allergies: ["Penicillin"] },
  { mrn: "MRN-1002", first: "Ko Min", last: "Htet", dob: "1984-01-20", sex: Sex.M, token: "OPD-019", department: 0, stage: VisitStage.TRIAGE, priority: Priority.SOON, symptoms: "Persistent cough", arrival: "08:24", allergies: ["Amoxicillin"] },
  { mrn: "MRN-1003", first: "Ei Ei", last: "Win", dob: "2019-03-18", sex: Sex.F, token: "OPD-020", department: 1, stage: VisitStage.WAITING, priority: Priority.ROUTINE, symptoms: "Sore throat", arrival: "08:31", allergies: [] },
  { mrn: "MRN-1004", first: "U Hla", last: "Tun", dob: "1962-06-11", sex: Sex.M, token: "OPD-017", department: 0, stage: VisitStage.PHARMACY, priority: Priority.SOON, symptoms: "Knee pain", arrival: "07:46", allergies: [] },
  { mrn: "MRN-1005", first: "Nandar", last: "Moe", dob: "1991-09-07", sex: Sex.F, token: "OPD-016", department: 0, stage: VisitStage.BILLING, priority: Priority.ROUTINE, symptoms: "Headache", arrival: "07:22", allergies: [] },
  { mrn: "MRN-1006", first: "Thant", last: "Zin", dob: "1975-05-22", sex: Sex.M, token: "OPD-011", department: 2, stage: VisitStage.DISCHARGED, priority: Priority.ROUTINE, symptoms: "Back strain", arrival: "06:40", allergies: [] },
  { mrn: "MRN-1007", first: "Su Su", last: "Lwin", dob: "1988-02-17", sex: Sex.F, token: "OPD-015", department: 3, stage: VisitStage.CONSULTATION, priority: Priority.SOON, symptoms: "Palpitations", arrival: "07:05", allergies: [] },
  { mrn: "MRN-1008", first: "Aung Ko", last: "Ko", dob: "1979-07-30", sex: Sex.M, token: "OPD-014", department: 5, stage: VisitStage.DISCHARGED, priority: Priority.ROUTINE, symptoms: "Ear discomfort", arrival: "06:58", allergies: [] },
] as const;

const staffMembers = [
  { email: "reception@careflow.test", employee: "CF-REC-001", name: "Aye Aye", role: StaffRole.RECEPTION, department: 0 },
  { email: "nurse@careflow.test", employee: "CF-NUR-001", name: "Maya Win", role: StaffRole.NURSE, department: 0 },
  { email: "doctor@careflow.test", employee: "CF-DOC-001", name: "Dr. Aye Min", role: StaffRole.DOCTOR, department: 0 },
  { email: "pharmacy@careflow.test", employee: "CF-PHA-001", name: "Thiri Moe", role: StaffRole.PHARMACY, department: null },
  { email: "cashier@careflow.test", employee: "CF-CAS-001", name: "Min Thu", role: StaffRole.CASHIER, department: null },
  { email: "admin@careflow.test", employee: "CF-ADM-001", name: "CareFlow Admin", role: StaffRole.ADMIN, department: null },
] as const;

async function clearOperationalData(db: PrismaClient) {
  await db.idempotencyRecord.deleteMany();
  await db.recoveryCode.deleteMany();
  await db.mfaSecret.deleteMany();
  await db.session.deleteMany();
  await db.account.deleteMany();
  await db.staffProfile.deleteMany();
  await db.verificationToken.deleteMany();
  await db.payment.deleteMany();
  await db.invoiceLine.deleteMany();
  await db.invoice.deleteMany();
  await db.inventoryTransaction.deleteMany();
  await db.prescription.deleteMany();
  await db.inventoryLot.deleteMany();
  await db.medication.deleteMany();
  await db.labOrder.deleteMany();
  await db.consultation.deleteMany();
  await db.triageObservation.deleteMany();
  await db.visit.deleteMany();
  await db.patientAllergy.deleteMany();
  await db.patient.deleteMany();
  await db.department.deleteMany();
  await db.user.deleteMany();
}

export async function seedCareFlow(db: PrismaClient) {
  await db.$executeRawUnsafe('TRUNCATE TABLE "AuditEvent"');
  await db.$transaction(async (tx) => {
    await clearOperationalData(tx as PrismaClient);

    for (const [index, [code, name, capacity]] of departments.entries()) {
      await tx.department.create({
        data: { id: ids.departments[index], code, name, capacity, displayOrder: index + 1 },
      });
    }

    for (const [index, staff] of staffMembers.entries()) {
      await tx.user.create({
        data: {
          id: ids.users[index],
          email: staff.email,
          name: staff.name,
          staffProfile: {
            create: {
              employeeNumber: staff.employee,
              displayName: staff.name,
              role: staff.role,
              departmentId:
                staff.department === null ? null : ids.departments[staff.department],
            },
          },
        },
      });
    }

    for (const [index, patient] of patients.entries()) {
      await tx.patient.create({
        data: {
          id: ids.patients[index],
          medicalRecordNumber: patient.mrn,
          firstName: patient.first,
          lastName: patient.last,
          dateOfBirth: new Date(`${patient.dob}T00:00:00.000Z`),
          sex: patient.sex,
          phone: "09 420 555 010",
          address: "12 Cedar Lane, fictional district",
          allergies: {
            create: patient.allergies.map((substance) => ({ substance })),
          },
        },
      });

      await tx.visit.create({
        data: {
          id: ids.visits[index],
          queueToken: patient.token,
          patientId: ids.patients[index],
          departmentId: ids.departments[patient.department],
          stage: patient.stage,
          priority: patient.priority,
          symptoms: patient.symptoms,
          arrivedAt: new Date(`2026-08-30T${patient.arrival}:00.000Z`),
          dischargedAt: patient.stage === VisitStage.DISCHARGED ? new Date("2026-08-30T09:00:00.000Z") : null,
        },
      });
    }

    const medicines = [
      ["MED-PARA-500", "Paracetamol", "Tablet", "500 mg", 250, 30, 86, "2027-02-14"],
      ["MED-AMOX-500", "Amoxicillin", "Capsule", "500 mg", 650, 30, 24, "2026-10-03"],
      ["MED-IBU-200", "Ibuprofen", "Tablet", "200 mg", 250, 20, 12, "2026-09-18"],
      ["MED-ORS", "Oral rehydration salts", "Sachet", "Standard", 300, 20, 44, "2027-01-28"],
    ] as const;

    for (const [index, medicine] of medicines.entries()) {
      const [code, name, form, strength, unitPrice, reorderAt, stock, expiry] = medicine;
      await tx.medication.create({
        data: {
          id: ids.medications[index], code, name, form, strength, unitPrice, reorderAt,
          lots: { create: { id: ids.lots[index], batchNumber: `BATCH-${index + 1}`, expiresAt: new Date(`${expiry}T00:00:00.000Z`), quantityOnHand: stock } },
          transactions: { create: { type: InventoryTransactionType.RECEIPT, quantity: stock, notes: "Fictional opening balance" } },
        },
      });
    }

    const kneeConsultation = await tx.consultation.create({
      data: { id: "60000000-0000-4000-8000-000000000001", visitId: ids.visits[3], findings: "Localized mechanical pain", diagnosis: "Mechanical knee pain", followUp: "Review if symptoms persist" },
    });
    await tx.prescription.create({
      data: { id: "61000000-0000-4000-8000-000000000001", visitId: ids.visits[3], consultationId: kneeConsultation.id, medicationId: ids.medications[2], quantity: 10, directions: "One tablet after food", status: PrescriptionStatus.ORDERED },
    });
    await tx.consultation.create({
      data: { id: "60000000-0000-4000-8000-000000000002", visitId: ids.visits[6], findings: "Vitals stable", diagnosis: "Assessment in progress", followUp: "ECG requested" },
    });

    const invoiceData = [
      { visit: 4, status: InvoiceStatus.UNPAID, total: 24000, paid: false },
      { visit: 5, status: InvoiceStatus.PAID, total: 15000, paid: true },
      { visit: 7, status: InvoiceStatus.PAID, total: 12000, paid: true },
    ] as const;
    for (const [index, invoice] of invoiceData.entries()) {
      await tx.invoice.create({
        data: {
          id: `70000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
          visitId: ids.visits[invoice.visit], status: invoice.status, subtotal: invoice.total, total: invoice.total,
          lines: { create: { type: InvoiceLineType.CONSULTATION, description: "Consultation", quantity: 1, unitPrice: invoice.total, total: invoice.total } },
          payments: invoice.paid ? { create: { amount: invoice.total, method: PaymentMethod.CASH, status: PaymentStatus.COMPLETED, reference: `DEMO-PAY-${index + 1}`, paidAt: new Date("2026-08-30T09:00:00.000Z") } } : undefined,
        },
      });
    }

    await tx.auditEvent.createMany({
      data: [
        { id: "80000000-0000-4000-8000-000000000001", actorName: "Reception Aye", roleSnapshot: "Reception", action: "Registered patient", entityType: "Visit", entityId: ids.visits[0], correlationId: "seed-001", createdAt: new Date("2026-08-30T08:12:00.000Z") },
        { id: "80000000-0000-4000-8000-000000000002", actorName: "Nurse Maya", roleSnapshot: "Nurse", action: "Called next patient", entityType: "Visit", entityId: ids.visits[1], correlationId: "seed-002", createdAt: new Date("2026-08-30T08:26:00.000Z") },
        { id: "80000000-0000-4000-8000-000000000003", actorName: "Dr. Aye", roleSnapshot: "Doctor", action: "Completed consultation", entityType: "Visit", entityId: ids.visits[3], correlationId: "seed-003", createdAt: new Date("2026-08-30T08:48:00.000Z") },
      ],
    });
  });

  return { departments: 6, patients: 8, visits: 8, medications: 4, invoices: 3, auditEvents: 3, users: 6, staff: 6 };
}

async function main() {
  try {
    const counts = await seedCareFlow(getDb());
    console.log("Seeded fictional CareFlow data", counts);
  } finally {
    await disconnectDb();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    console.error("CareFlow seed failed", error);
    process.exitCode = 1;
  });
}

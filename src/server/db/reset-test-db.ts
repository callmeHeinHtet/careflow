import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

export function createTestDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for integration tests");

  const database = new URL(connectionString).pathname.replace(/^\//, "");
  if (database !== "careflow_test") {
    throw new Error(`Refusing to run integration tests against database: ${database}`);
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export type TestDb = ReturnType<typeof createTestDb>;

export async function resetTestDb(db: TestDb) {
  await db.$executeRawUnsafe('TRUNCATE TABLE "AuditEvent"');
  await db.$transaction([
    db.idempotencyRecord.deleteMany(),
    db.recoveryCode.deleteMany(),
    db.mfaSecret.deleteMany(),
    db.session.deleteMany(),
    db.account.deleteMany(),
    db.staffProfile.deleteMany(),
    db.verificationToken.deleteMany(),
    db.payment.deleteMany(),
    db.invoiceLine.deleteMany(),
    db.invoice.deleteMany(),
    db.inventoryTransaction.deleteMany(),
    db.prescription.deleteMany(),
    db.inventoryLot.deleteMany(),
    db.medication.deleteMany(),
    db.labOrder.deleteMany(),
    db.consultation.deleteMany(),
    db.triageObservation.deleteMany(),
    db.visit.deleteMany(),
    db.patientAllergy.deleteMany(),
    db.patient.deleteMany(),
    db.department.deleteMany(),
    db.user.deleteMany(),
  ]);
}

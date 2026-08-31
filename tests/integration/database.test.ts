import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Priority, Sex, VisitStage } from "../../src/generated/prisma/client";
import { createTestDb, resetTestDb } from "../../src/server/db/reset-test-db";

const db = createTestDb();

beforeEach(async () => resetTestDb(db));
afterAll(async () => db.$disconnect());

describe("PostgreSQL operational foundation", () => {
  it("runs on PostgreSQL 16", async () => {
    const [row] = await db.$queryRaw<Array<{ version: string }>>`SELECT version()`;
    expect(row.version).toContain("PostgreSQL 16");
  });

  it("enforces queue-token uniqueness and retained patient history", async () => {
    const department = await db.department.create({
      data: { code: "GEN", name: "General Medicine", capacity: 4 },
    });
    const patient = await db.patient.create({
      data: {
        medicalRecordNumber: "MRN-1001",
        firstName: "May",
        lastName: "Thiri Aung",
        dateOfBirth: new Date("1997-04-12T00:00:00.000Z"),
        sex: Sex.F,
        phone: "09 420 555 010",
        address: "Fictional address",
      },
    });
    const visit = {
      queueToken: "OPD-018",
      patientId: patient.id,
      departmentId: department.id,
      stage: VisitStage.WAITING,
      priority: Priority.URGENT,
      symptoms: "Fever and fatigue",
      arrivedAt: new Date("2026-08-30T08:12:00.000Z"),
    };

    await db.visit.create({ data: visit });

    await expect(db.visit.create({ data: visit })).rejects.toThrow();
    await expect(db.patient.delete({ where: { id: patient.id } })).rejects.toThrow();
  });
});

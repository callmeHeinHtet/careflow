import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { seedCareFlow } from "../../prisma/seed";
import { createTestDb, resetTestDb } from "../../src/server/db/reset-test-db";
import { getDashboardSnapshot } from "../../src/server/repositories/dashboard-repository";
import { getPatientById, listPatients } from "../../src/server/repositories/patient-repository";
import { decimalToNumber, dateToIso } from "../../src/server/serializers/patient";

const db = createTestDb();

beforeEach(async () => {
  await resetTestDb(db);
  await seedCareFlow(db);
});
afterAll(async () => db.$disconnect());

describe("dashboard repository", () => {
  it("derives metrics and department load from persisted rows", async () => {
    const snapshot = await getDashboardSnapshot(db, new Date("2026-08-30T09:00:00.000Z"));

    expect(snapshot.metrics).toEqual({
      totalPatients: 8,
      waitingNow: 3,
      completedVisits: 2,
      averageWaitMinutes: 38,
      lowStockMedications: 2,
    });
    expect(snapshot.departments.find((department) => department.code === "GEN")).toMatchObject({
      capacity: 4,
      activeVisits: 4,
    });
  });
});

describe("patient repository", () => {
  it.each(["May", "OPD-018", "general medicine"])(
    "searches case-insensitively by %s",
    async (query) => {
      const page = await listPatients(db, { query, limit: 25 });
      expect(page.items.some((patient) => patient.name === "May Thiri Aung")).toBe(true);
    },
  );

  it("uses bounded cursor pagination", async () => {
    const first = await listPatients(db, { limit: 3 });
    const second = await listPatients(db, { limit: 3, cursor: first.nextCursor ?? undefined });
    const clamped = await listPatients(db, { limit: 1000 });

    expect(first.items).toHaveLength(3);
    expect(first.nextCursor).toBeTruthy();
    expect(second.items).toHaveLength(3);
    expect(new Set([...first.items, ...second.items].map((patient) => patient.id)).size).toBe(6);
    expect(clamped.items).toHaveLength(8);
  });

  it("excludes soft-deleted records and returns safe patient detail", async () => {
    const may = await db.patient.findUniqueOrThrow({ where: { medicalRecordNumber: "MRN-1001" } });
    const detail = await getPatientById(db, may.id);
    await db.patient.update({ where: { id: may.id }, data: { deletedAt: new Date() } });
    const page = await listPatients(db, { query: "May", limit: 25 });

    expect(detail).toMatchObject({ name: "May Thiri Aung", allergies: ["Penicillin"] });
    expect(detail?.visits[0].arrivedAt).toBe("2026-08-30T08:12:00.000Z");
    expect(page.items).toHaveLength(0);
  });

  it("serializes database dates and decimals to JSON-safe primitives", () => {
    expect(dateToIso(new Date("2026-08-30T08:12:00.000Z"))).toBe("2026-08-30T08:12:00.000Z");
    expect(decimalToNumber({ toNumber: () => 12000 })).toBe(12000);
  });
});

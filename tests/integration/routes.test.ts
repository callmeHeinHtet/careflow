import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { seedCareFlow } from "../../prisma/seed";
import { GET as getDashboard } from "../../src/app/api/dashboard/route";
import { GET as getPatients, parsePatientQuery } from "../../src/app/api/patients/route";
import { disconnectDb } from "../../src/server/db/client";
import { createTestDb, resetTestDb } from "../../src/server/db/reset-test-db";

const db = createTestDb();

beforeEach(async () => {
  await resetTestDb(db);
  await seedCareFlow(db);
});

afterAll(async () => {
  await db.$disconnect();
  await disconnectDb();
});

describe("database-backed read routes", () => {
  it("returns a no-store dashboard envelope", async () => {
    const response = await getDashboard();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.data.metrics).toMatchObject({ totalPatients: 8, waitingNow: 3 });
  });

  it("supports patient search and bounded pagination", async () => {
    const response = await getPatients(
      new Request("http://localhost/api/patients?query=May&limit=3"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].name).toBe("May Thiri Aung");
    expect(parsePatientQuery(new URLSearchParams("limit=1000")).limit).toBe(25);
  });

  it("returns a stable validation error for malformed cursors", async () => {
    const response = await getPatients(
      new Request("http://localhost/api/patients?cursor=not-a-uuid"),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "VALIDATION_FAILED", message: "Invalid patient query" },
    });
  });

  it("sanitizes unexpected database failures", async () => {
    const original = process.env.DATABASE_URL;
    await disconnectDb();
    process.env.DATABASE_URL = "postgresql://careflow:secret@127.0.0.1:1/careflow_test";

    try {
      const response = await getDashboard();
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        error: { code: "INTERNAL_ERROR", message: "The request could not be completed" },
      });
      expect(JSON.stringify(body)).not.toContain("secret");
      expect(response.headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/);
    } finally {
      await disconnectDb();
      process.env.DATABASE_URL = original;
    }
  });
});

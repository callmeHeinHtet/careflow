import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { seedCareFlow } from "../../prisma/seed";
import { GET as getDashboard } from "../../src/app/api/dashboard/route";
import { GET as getPatients, parsePatientQuery } from "../../src/app/api/patients/route";
import { AccountStatus } from "../../src/generated/prisma/client";
import { disconnectDb } from "../../src/server/db/client";
import { createTestDb, resetTestDb } from "../../src/server/db/reset-test-db";

const db = createTestDb();
const sessionToken = "route-test-session-token";

beforeEach(async () => {
  await resetTestDb(db);
  await seedCareFlow(db);
  const admin = await db.user.update({
    where: { email: "admin@careflow.test" },
    data: { status: AccountStatus.ACTIVE, mfaEnrolledAt: new Date() },
  });
  await db.session.create({
    data: {
      sessionToken,
      userId: admin.id,
      expires: new Date(Date.now() + 60 * 60 * 1000),
      absoluteExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      mfaVerifiedAt: new Date(),
    },
  });
});

afterAll(async () => {
  await db.$disconnect();
  await disconnectDb();
});

describe("database-backed read routes", () => {
  function authenticatedRequest(path: string) {
    return new NextRequest(`http://localhost${path}`, {
      headers: { cookie: `authjs.session-token=${sessionToken}` },
    });
  }

  it("rejects unauthenticated operational reads", async () => {
    const [dashboard, patients] = await Promise.all([
      getDashboard(new NextRequest("http://localhost/api/dashboard")),
      getPatients(new NextRequest("http://localhost/api/patients")),
    ]);

    expect(dashboard.status).toBe(401);
    expect(patients.status).toBe(401);
  });

  it("returns a no-store dashboard envelope", async () => {
    const response = await getDashboard(authenticatedRequest("/api/dashboard"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.data.metrics).toMatchObject({ totalPatients: 8, waitingNow: 3 });
  });

  it("supports patient search and bounded pagination", async () => {
    const response = await getPatients(
      authenticatedRequest("/api/patients?query=May&limit=3"),
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
      authenticatedRequest("/api/patients?cursor=not-a-uuid"),
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
      const response = await getDashboard(authenticatedRequest("/api/dashboard"));
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

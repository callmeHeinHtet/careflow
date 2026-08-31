import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { seedCareFlow } from "../../prisma/seed";
import { GET as catalogRoute } from "../../src/app/api/consultation-catalog/route";
import { POST as consultationRoute } from "../../src/app/api/visits/[id]/consultation/route";
import { AccountStatus } from "../../src/generated/prisma/client";
import { disconnectDb } from "../../src/server/db/client";
import { createTestDb, resetTestDb } from "../../src/server/db/reset-test-db";

const db = createTestDb();
const sessions = { doctor: "consultation-route-doctor", nurse: "consultation-route-nurse" };

beforeEach(async () => {
  await resetTestDb(db);
  await seedCareFlow(db);
  for (const [role, token] of Object.entries(sessions)) {
    const user = await db.user.update({
      where: { email: `${role}@careflow.test` },
      data: { status: AccountStatus.ACTIVE, mfaEnrolledAt: new Date() },
    });
    await db.session.create({
      data: {
        sessionToken: token,
        userId: user.id,
        expires: new Date(Date.now() + 3_600_000),
        absoluteExpiresAt: new Date(Date.now() + 3_600_000),
        mfaVerifiedAt: new Date(),
      },
    });
  }
});

afterAll(async () => {
  await db.$disconnect();
  await disconnectDb();
});

function authRequest(path: string, token: string) {
  return new NextRequest(`http://localhost${path}`, {
    headers: { cookie: `authjs.session-token=${token}` },
  });
}

function mutationRequest(path: string, token: string, body: unknown, key: string) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      cookie: `authjs.session-token=${token}`,
      "content-type": "application/json",
      "idempotency-key": key,
      origin: "http://localhost",
    },
  });
}

describe("consultation routes", () => {
  it("protects the catalog and exposes server-owned prices", async () => {
    expect((await catalogRoute(new NextRequest("http://localhost/api/consultation-catalog"))).status).toBe(401);
    const response = await catalogRoute(authRequest("/api/consultation-catalog", sessions.doctor));
    expect(response.status).toBe(200);
    expect((await response.json()).data.labServices).toHaveLength(3);
  });

  it("allows doctors and forbids nurses from completing consultation", async () => {
    const visit = await db.visit.update({
      where: { queueToken: "OPD-018" },
      data: { stage: "CONSULTATION" },
    });
    const context = { params: Promise.resolve({ id: visit.id }) };
    const input = {
      version: 1,
      findings: "Patient examined.",
      diagnosis: "Clinician-entered assessment",
      followUp: null,
      labServiceIds: [],
      prescriptions: [],
    };
    const forbidden = await consultationRoute(
      mutationRequest(`/api/visits/${visit.id}/consultation`, sessions.nurse, input, "consultation_route_0001"),
      context,
    );
    expect(forbidden.status).toBe(403);
    const allowed = await consultationRoute(
      mutationRequest(`/api/visits/${visit.id}/consultation`, sessions.doctor, input, "consultation_route_0002"),
      context,
    );
    expect(allowed.status).toBe(200);
  });
});

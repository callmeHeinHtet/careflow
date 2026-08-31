import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { seedCareFlow } from "../../prisma/seed";
import { GET as listVisitRoute } from "../../src/app/api/visits/route";
import { GET as getVisitRoute, PATCH as priorityRoute } from "../../src/app/api/visits/[id]/route";
import { POST as triageRoute } from "../../src/app/api/visits/[id]/triage/route";
import { AccountStatus } from "../../src/generated/prisma/client";
import { disconnectDb } from "../../src/server/db/client";
import { createTestDb, resetTestDb } from "../../src/server/db/reset-test-db";

const db = createTestDb();
const sessions = { nurse: "visit-route-nurse", doctor: "visit-route-doctor" };

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

describe("visit routes", () => {
  it("protects visit list and detail reads", async () => {
    expect((await listVisitRoute(new NextRequest("http://localhost/api/visits"))).status).toBe(401);
    const list = await listVisitRoute(authRequest("/api/visits?stage=WAITING", sessions.nurse));
    expect(list.status).toBe(200);
    const visitId = (await list.json()).data.items[0].id;
    const detail = await getVisitRoute(
      authRequest(`/api/visits/${visitId}`, sessions.nurse),
      { params: Promise.resolve({ id: visitId }) },
    );
    expect(detail.status).toBe(200);
  });

  it("allows nurses and forbids doctors from queue-priority changes", async () => {
    const visit = await db.visit.findUniqueOrThrow({ where: { queueToken: "OPD-018" } });
    const context = { params: Promise.resolve({ id: visit.id }) };
    const forbidden = await priorityRoute(
      mutationRequest(`/api/visits/${visit.id}`, sessions.doctor, { version: 1, priority: "URGENT" }, "priority_route_0001"),
      context,
    );
    expect(forbidden.status).toBe(403);
    const allowed = await priorityRoute(
      mutationRequest(`/api/visits/${visit.id}`, sessions.nurse, { version: 1, priority: "URGENT" }, "priority_route_0002"),
      context,
    );
    expect(allowed.status).toBe(200);
  });

  it("allows nurses and forbids doctors from recording triage", async () => {
    const visit = await db.visit.findUniqueOrThrow({ where: { queueToken: "OPD-019" } });
    const context = { params: Promise.resolve({ id: visit.id }) };
    const input = {
      version: 1,
      temperature: 37.2,
      bloodPressure: "120/80",
      heartRate: 82,
      oxygenSat: 98,
      symptoms: "Persistent cough",
      notes: "Patient-reported symptoms recorded.",
      priority: "SOON",
    };
    expect((await triageRoute(mutationRequest(`/api/visits/${visit.id}/triage`, sessions.doctor, input, "triage_route_0001"), context)).status).toBe(403);
    expect((await triageRoute(mutationRequest(`/api/visits/${visit.id}/triage`, sessions.nurse, input, "triage_route_0002"), context)).status).toBe(200);
  });
});

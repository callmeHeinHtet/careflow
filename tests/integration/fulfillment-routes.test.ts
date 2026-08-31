import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { seedCareFlow } from "../../prisma/seed";
import { POST as dispenseRoute } from "../../src/app/api/visits/[id]/dispense/route";
import { POST as paymentRoute } from "../../src/app/api/visits/[id]/payment/route";
import { AccountStatus } from "../../src/generated/prisma/client";
import { disconnectDb } from "../../src/server/db/client";
import { createTestDb, resetTestDb } from "../../src/server/db/reset-test-db";

const db = createTestDb();
const sessions = {
  pharmacy: "fulfillment-route-pharmacy",
  cashier: "fulfillment-route-cashier",
  doctor: "fulfillment-route-doctor",
};

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

describe("fulfillment routes", () => {
  it("allows pharmacy and forbids doctors from dispensing", async () => {
    const visit = await db.visit.findUniqueOrThrow({ where: { queueToken: "OPD-017" } });
    const prescription = await db.prescription.findFirstOrThrow({ where: { visitId: visit.id } });
    const context = { params: Promise.resolve({ id: visit.id }) };
    const input = { version: 1, prescriptionId: prescription.id };
    expect((await dispenseRoute(mutationRequest(`/api/visits/${visit.id}/dispense`, sessions.doctor, input, "dispense_route_0001"), context)).status).toBe(403);
    expect((await dispenseRoute(mutationRequest(`/api/visits/${visit.id}/dispense`, sessions.pharmacy, input, "dispense_route_0002"), context)).status).toBe(200);
  });

  it("allows cashiers and forbids doctors from settling invoices", async () => {
    const visit = await db.visit.findUniqueOrThrow({ where: { queueToken: "OPD-016" } });
    const context = { params: Promise.resolve({ id: visit.id }) };
    const input = { visitVersion: 1, invoiceVersion: 1, method: "CASH" };
    expect((await paymentRoute(mutationRequest(`/api/visits/${visit.id}/payment`, sessions.doctor, input, "payment_route_0001"), context)).status).toBe(403);
    expect((await paymentRoute(mutationRequest(`/api/visits/${visit.id}/payment`, sessions.cashier, input, "payment_route_0002"), context)).status).toBe(200);
  });
});

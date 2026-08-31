import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { seedCareFlow } from "../../prisma/seed";
import { GET as auditRoute } from "../../src/app/api/audit/route";
import { AccountStatus } from "../../src/generated/prisma/client";
import { disconnectDb } from "../../src/server/db/client";
import { createTestDb, resetTestDb } from "../../src/server/db/reset-test-db";
import { listAuditEvents } from "../../src/server/repositories/audit-repository";

const db = createTestDb();
const sessions = { doctor: "audit-route-doctor", admin: "audit-route-admin" };

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
  await db.auditEvent.createMany({
    data: [
      {
        actorName: "Dr. Aye Min",
        actorUserId: "90000000-0000-4000-8000-000000000003",
        roleSnapshot: "DOCTOR",
        action: "CONSULTATION_COMPLETED",
        entityType: "Visit",
        entityId: "visit-doctor",
        correlationId: "audit-doctor",
      },
      {
        actorName: "Min Thu",
        actorUserId: "90000000-0000-4000-8000-000000000005",
        roleSnapshot: "CASHIER",
        action: "INVOICE_SETTLED",
        entityType: "Invoice",
        entityId: "invoice-cashier",
        correlationId: "audit-cashier",
      },
    ],
  });
});

afterAll(async () => {
  await db.$disconnect();
  await disconnectDb();
});

function request(token?: string, query = "") {
  return new NextRequest(`http://localhost/api/audit${query}`, {
    headers: token ? { cookie: `authjs.session-token=${token}` } : undefined,
  });
}

describe("audit reads", () => {
  it("filters limited roles while administrators receive the complete stream", async () => {
    const doctor = await listAuditEvents(db, {
      actorUserId: "90000000-0000-4000-8000-000000000003",
      role: "DOCTOR",
      limit: 50,
    });
    const admin = await listAuditEvents(db, {
      actorUserId: "90000000-0000-4000-8000-000000000006",
      role: "ADMIN",
      limit: 50,
    });
    expect(doctor.items.some((event) => event.action === "CONSULTATION_COMPLETED")).toBe(true);
    expect(doctor.items.some((event) => event.action === "INVOICE_SETTLED")).toBe(false);
    expect(admin.items).toHaveLength(5);
  });

  it("protects the route and returns a no-store cursor envelope", async () => {
    expect((await auditRoute(request())).status).toBe(401);
    const response = await auditRoute(request(sessions.admin, "?limit=2"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.data.items).toHaveLength(2);
    expect(body.data.nextCursor).toMatch(/^[0-9a-f-]{36}$/);
  });
});

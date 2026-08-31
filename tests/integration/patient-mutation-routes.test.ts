import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { seedCareFlow } from "../../prisma/seed";
import { POST as registerPatientRoute } from "../../src/app/api/patients/route";
import { GET as getPatientRoute, PATCH as updatePatientRoute } from "../../src/app/api/patients/[id]/route";
import { AccountStatus } from "../../src/generated/prisma/client";
import { disconnectDb } from "../../src/server/db/client";
import { createTestDb, resetTestDb } from "../../src/server/db/reset-test-db";

const db = createTestDb();
const sessions = {
  reception: "patient-route-reception-session",
  doctor: "patient-route-doctor-session",
};

const registration = {
  firstName: "Mya",
  lastName: "Win",
  dateOfBirth: "1994-05-17",
  sex: "F",
  phone: "+95 9 420 555 123",
  address: "Yangon",
  allergies: [],
  departmentId: "10000000-0000-4000-8000-000000000001",
  symptoms: "Persistent fever",
  priority: "SOON",
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

describe("patient mutation routes", () => {
  it("allows reception to register and returns replay metadata", async () => {
    const first = await registerPatientRoute(
      mutationRequest("/api/patients", sessions.reception, registration, "route_register_patient_01"),
    );
    const replay = await registerPatientRoute(
      mutationRequest("/api/patients", sessions.reception, registration, "route_register_patient_01"),
    );

    expect(first.status).toBe(201);
    expect(first.headers.get("idempotency-replayed")).toBe("false");
    expect(replay.headers.get("idempotency-replayed")).toBe("true");
  });

  it("forbids doctor registration and cross-origin mutations", async () => {
    const forbidden = await registerPatientRoute(
      mutationRequest("/api/patients", sessions.doctor, registration, "route_register_patient_02"),
    );
    expect(forbidden.status).toBe(403);

    const crossOrigin = mutationRequest(
      "/api/patients",
      sessions.reception,
      registration,
      "route_register_patient_03",
    );
    crossOrigin.headers.set("origin", "https://evil.test");
    expect((await registerPatientRoute(crossOrigin)).status).toBe(403);
  });

  it("serves detail and performs versioned demographic updates", async () => {
    const patient = await db.patient.findUniqueOrThrow({ where: { medicalRecordNumber: "MRN-1001" } });
    const context = { params: Promise.resolve({ id: patient.id }) };
    const detail = await getPatientRoute(
      new NextRequest(`http://localhost/api/patients/${patient.id}`, {
        headers: { cookie: `authjs.session-token=${sessions.reception}` },
      }),
      context,
    );
    expect(detail.status).toBe(200);

    const updateRequest = mutationRequest(
      `/api/patients/${patient.id}`,
      sessions.reception,
      { version: 1, phone: "09 777 888 999" },
      "route_update_patient_001",
    );
    const updated = await updatePatientRoute(updateRequest, context);
    expect(updated.status).toBe(200);
    expect((await updated.json()).data.patient.version).toBe(2);
  });
});

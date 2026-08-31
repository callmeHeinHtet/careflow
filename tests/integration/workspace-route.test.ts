import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { seedCareFlow } from "../../prisma/seed";
import { GET as workspaceRoute } from "../../src/app/api/workspace/route";
import { AccountStatus } from "../../src/generated/prisma/client";
import { disconnectDb } from "../../src/server/db/client";
import { createTestDb, resetTestDb } from "../../src/server/db/reset-test-db";
import { getWorkspaceSnapshot } from "../../src/server/repositories/workspace-repository";

const db = createTestDb();
const adminId = "90000000-0000-4000-8000-000000000006";

beforeEach(async () => {
  await resetTestDb(db);
  await seedCareFlow(db);
});

afterAll(async () => {
  await db.$disconnect();
  await disconnectDb();
});

describe("workspace snapshot", () => {
  it("maps persisted operations into the workstation view model", async () => {
    const snapshot = await getWorkspaceSnapshot(db, { actorUserId: adminId, role: "ADMIN" });
    expect(snapshot.patients).toHaveLength(8);
    expect(snapshot.inventory).toHaveLength(4);
    expect(snapshot.audit).toHaveLength(3);
    expect(snapshot.patients[0]).toMatchObject({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      visitId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      visitVersion: 1,
    });
    expect(snapshot.inventory.find((item) => item.name.includes("Ibuprofen"))?.stock).toBe(12);
  });

  it("protects the endpoint and returns no-store data", async () => {
    expect((await workspaceRoute(new NextRequest("http://localhost/api/workspace"))).status).toBe(401);
    const user = await db.user.update({
      where: { id: adminId },
      data: { status: AccountStatus.ACTIVE, mfaEnrolledAt: new Date() },
    });
    await db.session.create({
      data: {
        sessionToken: "workspace-admin-session",
        userId: user.id,
        expires: new Date(Date.now() + 3_600_000),
        absoluteExpiresAt: new Date(Date.now() + 3_600_000),
        mfaVerifiedAt: new Date(),
      },
    });
    const response = await workspaceRoute(
      new NextRequest("http://localhost/api/workspace", {
        headers: { cookie: "authjs.session-token=workspace-admin-session" },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).data.patients).toHaveLength(8);
  });
});

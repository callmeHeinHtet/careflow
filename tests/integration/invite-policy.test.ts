import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { AccountStatus, EmploymentStatus, StaffRole } from "../../src/generated/prisma/client";
import { findEligibleStaff } from "../../src/server/auth/invite-policy";
import { createTestDb, resetTestDb } from "../../src/server/db/reset-test-db";

const db = createTestDb();

beforeEach(async () => resetTestDb(db));
afterAll(async () => db.$disconnect());

async function createStaff(
  email: string,
  status: AccountStatus,
  employmentStatus: EmploymentStatus = EmploymentStatus.ACTIVE,
) {
  return db.user.create({
    data: {
      email,
      status,
      staffProfile: {
        create: {
          employeeNumber: `CF-${email.split("@")[0]}`,
          displayName: email,
          role: StaffRole.NURSE,
          employmentStatus,
        },
      },
    },
  });
}

describe("invite-only login policy", () => {
  it.each([AccountStatus.INVITED, AccountStatus.ACTIVE])(
    "allows active staff with %s account state",
    async (status) => {
      await createStaff("nurse@careflow.test", status);
      await expect(findEligibleStaff(db, " Nurse@CareFlow.Test ")).resolves.toMatchObject({
        email: "nurse@careflow.test",
        status,
      });
    },
  );

  it.each([AccountStatus.SUSPENDED, AccountStatus.DEACTIVATED])(
    "rejects %s accounts without distinguishing them from unknown addresses",
    async (status) => {
      await createStaff("nurse@careflow.test", status);
      await expect(findEligibleStaff(db, "nurse@careflow.test")).resolves.toBeNull();
    },
  );

  it("rejects ended employment, soft-deleted users, and unknown addresses", async () => {
    await createStaff("ended@careflow.test", AccountStatus.ACTIVE, EmploymentStatus.ENDED);
    const deleted = await createStaff("deleted@careflow.test", AccountStatus.ACTIVE);
    await db.user.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } });

    await expect(findEligibleStaff(db, "ended@careflow.test")).resolves.toBeNull();
    await expect(findEligibleStaff(db, "deleted@careflow.test")).resolves.toBeNull();
    await expect(findEligibleStaff(db, "unknown@careflow.test")).resolves.toBeNull();
  });
});

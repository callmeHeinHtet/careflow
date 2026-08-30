import { AccountStatus, EmploymentStatus, type PrismaClient } from "../../generated/prisma/client";

const eligibleAccountStates = [AccountStatus.INVITED, AccountStatus.ACTIVE] as const;

export function normalizeStaffEmail(input: string): string {
  const email = input.normalize("NFKC").trim().toLowerCase();
  if (
    email.length < 3 ||
    email.length > 254 ||
    email.includes('"') ||
    email.includes(",") ||
    /[\r\n]/.test(email)
  ) {
    throw new Error("Invalid email address");
  }

  const parts = email.split("@");
  if (parts.length !== 2) throw new Error("Invalid email address");

  const [local, domain] = parts;
  const localPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i;
  const domainPattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
  if (!local || local.length > 64 || !domain || !localPattern.test(local) || !domainPattern.test(domain)) {
    throw new Error("Invalid email address");
  }

  return email;
}

export async function findEligibleStaff(db: PrismaClient, input: string) {
  const email = normalizeStaffEmail(input);
  return db.user.findFirst({
    where: {
      email,
      status: { in: [...eligibleAccountStates] },
      deletedAt: null,
      staffProfile: { is: { employmentStatus: EmploymentStatus.ACTIVE } },
    },
    include: { staffProfile: true },
  });
}

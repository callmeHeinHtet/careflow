import { describe, expect, it } from "vitest";
import { StaffRole } from "../../src/generated/prisma/client";
import { Capability, hasCapability } from "../../src/server/auth/permissions";

const everyRole = Object.values(StaffRole);

describe("CareFlow permission matrix", () => {
  it.each(everyRole)("allows %s to read the operational dashboard and patient list", (role) => {
    expect(hasCapability(role, Capability.DASHBOARD_READ)).toBe(true);
    expect(hasCapability(role, Capability.PATIENT_READ)).toBe(true);
  });

  it("restricts workflow writes to the responsible roles and admin", () => {
    expect(hasCapability(StaffRole.RECEPTION, Capability.PATIENT_REGISTER)).toBe(true);
    expect(hasCapability(StaffRole.NURSE, Capability.TRIAGE_WRITE)).toBe(true);
    expect(hasCapability(StaffRole.DOCTOR, Capability.CONSULTATION_WRITE)).toBe(true);
    expect(hasCapability(StaffRole.PHARMACY, Capability.INVENTORY_DISPENSE)).toBe(true);
    expect(hasCapability(StaffRole.CASHIER, Capability.INVOICE_SETTLE)).toBe(true);

    expect(hasCapability(StaffRole.RECEPTION, Capability.CONSULTATION_WRITE)).toBe(false);
    expect(hasCapability(StaffRole.DOCTOR, Capability.INVENTORY_DISPENSE)).toBe(false);
    expect(hasCapability(StaffRole.CASHIER, Capability.TRIAGE_WRITE)).toBe(false);
  });

  it("grants every capability only to admin", () => {
    for (const capability of Object.values(Capability)) {
      expect(hasCapability(StaffRole.ADMIN, capability)).toBe(true);
    }
    expect(hasCapability(StaffRole.DOCTOR, Capability.ADMIN_MANAGE)).toBe(false);
    expect(hasCapability(StaffRole.NURSE, Capability.AUDIT_READ_ALL)).toBe(false);
  });
});

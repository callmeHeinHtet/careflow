import { describe, expect, it } from "vitest";
import { StaffRole } from "../../src/generated/prisma/client";
import { auditActionsForRole, auditQuerySchema } from "../../src/server/validation/audit-query";

describe("audit read policy", () => {
  it("maps each operational role to its workflow actions", () => {
    expect(auditActionsForRole(StaffRole.DOCTOR)).toContain("CONSULTATION_COMPLETED");
    expect(auditActionsForRole(StaffRole.PHARMACY)).toEqual(["PRESCRIPTION_DISPENSED"]);
    expect(auditActionsForRole(StaffRole.CASHIER)).toEqual(["INVOICE_SETTLED"]);
    expect(auditActionsForRole(StaffRole.ADMIN)).toBeNull();
  });

  it("bounds cursor queries", () => {
    expect(auditQuerySchema.parse({ limit: "1000" }).limit).toBe(50);
    expect(() => auditQuerySchema.parse({ cursor: "invalid" })).toThrow();
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("CareFlow authentication schema", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  it("defines Auth.js adapter and staff identity models", () => {
    for (const model of [
      "User",
      "Account",
      "Session",
      "VerificationToken",
      "StaffProfile",
      "MfaSecret",
      "RecoveryCode",
    ]) {
      expect(schema).toContain(`model ${model} {`);
    }
  });

  it("supports revocable MFA-aware database sessions", () => {
    expect(schema).toMatch(/model Session \{[\s\S]*sessionToken\s+String\s+@unique/);
    expect(schema).toMatch(/model Session \{[\s\S]*lastSeenAt\s+DateTime/);
    expect(schema).toMatch(/model Session \{[\s\S]*absoluteExpiresAt\s+DateTime/);
    expect(schema).toMatch(/model Session \{[\s\S]*mfaVerifiedAt\s+DateTime\?/);
    expect(schema).toMatch(/model MfaSecret \{[\s\S]*lastUsedCounter\s+Int\?/);
  });

  it("defines the six approved staff roles and account states", () => {
    for (const role of ["RECEPTION", "NURSE", "DOCTOR", "PHARMACY", "CASHIER", "ADMIN"]) {
      expect(schema).toMatch(new RegExp(`enum StaffRole \\{[\\s\\S]*${role}`));
    }

    for (const state of ["INVITED", "ACTIVE", "SUSPENDED", "DEACTIVATED"]) {
      expect(schema).toMatch(new RegExp(`enum AccountStatus \\{[\\s\\S]*${state}`));
    }
  });

  it("enforces unique staff and one-time recovery-code identities", () => {
    expect(schema).toMatch(/employeeNumber\s+String\s+@unique/);
    expect(schema).toContain("@@unique([userId, codeHash])");
    expect(schema).toContain("@@unique([identifier, token])");
  });
});

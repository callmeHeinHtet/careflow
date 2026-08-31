import { describe, expect, it } from "vitest";
import { normalizeStaffEmail } from "../../src/server/auth/invite-policy";

describe("staff email normalization", () => {
  it("normalizes case, whitespace, and compatible Unicode", () => {
    expect(normalizeStaffEmail("  ADMIN＠CareFlow.Test ")).toBe("admin@careflow.test");
  });

  it.each([
    "",
    "missing-at-sign",
    "two@@careflow.test",
    '"admin@evil.test"@careflow.test',
    "admin@careflow.test,attacker@evil.test",
  ])("rejects an unsafe address: %s", (email) => {
    expect(() => normalizeStaffEmail(email)).toThrow("Invalid email address");
  });
});

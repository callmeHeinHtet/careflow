import { describe, expect, it } from "vitest";
import {
  decryptMfaSecret,
  encryptMfaSecret,
  hashRecoveryCode,
  normalizeRecoveryCode,
} from "../../src/server/auth/mfa-crypto";

const key = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";
const userId = "90000000-0000-4000-8000-000000000006";

describe("MFA cryptography", () => {
  it("round-trips a secret in a versioned AES-256-GCM envelope", () => {
    const encrypted = encryptMfaSecret("JBSWY3DPEHPK3PXP", key, userId);

    expect(encrypted).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(encrypted).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decryptMfaSecret(encrypted, key, userId)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("rejects tampering, another user, and malformed envelopes", () => {
    const encrypted = encryptMfaSecret("JBSWY3DPEHPK3PXP", key, userId);
    const parts = encrypted.split(".");
    parts[3] = `${parts[3].startsWith("A") ? "B" : "A"}${parts[3].slice(1)}`;
    const tampered = parts.join(".");

    expect(() => decryptMfaSecret(tampered, key, userId)).toThrow("Invalid encrypted MFA secret");
    expect(() => decryptMfaSecret(encrypted, key, "another-user")).toThrow(
      "Invalid encrypted MFA secret",
    );
    expect(() => decryptMfaSecret("not-an-envelope", key, userId)).toThrow(
      "Invalid encrypted MFA secret",
    );
  });

  it("normalizes and hashes recovery codes with a server pepper", () => {
    const pepper = "test-recovery-code-pepper-at-least-32-characters";

    expect(normalizeRecoveryCode(" abcd1 - efgh2 ")).toBe("ABCD1EFGH2");
    expect(hashRecoveryCode("ABCD1-EFGH2", pepper)).toBe(
      hashRecoveryCode(" abcd1efgh2 ", pepper),
    );
    expect(hashRecoveryCode("ABCD1-EFGH2", pepper)).not.toContain("ABCD1");
    expect(() => normalizeRecoveryCode("short")).toThrow("Invalid recovery code");
  });
});

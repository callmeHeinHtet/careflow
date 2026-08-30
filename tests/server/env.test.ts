import { describe, expect, it } from "vitest";
import { readServerEnv } from "../../src/server/env";

describe("server environment", () => {
  const validEnvironment = {
    DATABASE_URL: "postgresql://user:password@127.0.0.1:5432/careflow",
    AUTH_SECRET: "test-auth-secret-with-at-least-32-characters",
    AUTH_URL: "http://localhost:3000",
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: "1025",
    SMTP_FROM: "CareFlow <no-reply@careflow.test>",
    MFA_ENCRYPTION_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
    RECOVERY_CODE_PEPPER: "test-recovery-code-pepper-at-least-32-characters",
  };

  it("rejects missing production secrets without exposing a raw Zod error", () => {
    expect(() => readServerEnv({})).toThrow(
      "Invalid server environment: AUTH_SECRET, AUTH_URL, DATABASE_URL, MFA_ENCRYPTION_KEY, RECOVERY_CODE_PEPPER, SMTP_FROM, SMTP_HOST, SMTP_PORT",
    );
  });

  it("rejects non-PostgreSQL URLs", () => {
    expect(() =>
      readServerEnv({ ...validEnvironment, DATABASE_URL: "https://example.com/database" }),
    ).toThrow(
      "Invalid server environment: DATABASE_URL",
    );
  });

  it("rejects malformed encryption key material", () => {
    expect(() => readServerEnv({ ...validEnvironment, MFA_ENCRYPTION_KEY: "too-short" })).toThrow(
      "Invalid server environment: MFA_ENCRYPTION_KEY",
    );
  });

  it("accepts a complete provider-neutral auth environment", () => {
    const result = readServerEnv(validEnvironment);

    expect(result.DATABASE_URL).toContain("postgresql://");
    expect(result.SMTP_PORT).toBe(1025);
    expect(Buffer.from(result.MFA_ENCRYPTION_KEY, "base64")).toHaveLength(32);
  });
});

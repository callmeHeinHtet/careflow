import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("database configuration", () => {
  it("documents separate development and test database URLs", () => {
    const development = readFileSync(".env.example", "utf8");
    const test = readFileSync(".env.test.example", "utf8");

    expect(development).toContain("/careflow?schema=public");
    expect(test).toContain("/careflow_test?schema=public");
    expect(development).toContain("@127.0.0.1:5432");
    expect(test).toContain("@127.0.0.1:5432");
  });

  it("documents local SMTP and non-placeholder security variables", () => {
    const development = readFileSync(".env.example", "utf8");
    const compose = readFileSync("compose.yaml", "utf8");

    expect(development).toContain("SMTP_HOST=127.0.0.1");
    expect(development).toContain("SMTP_PORT=1025");
    expect(development).toContain("AUTH_SECRET=");
    expect(development).toContain("MFA_ENCRYPTION_KEY=");
    expect(development).toContain("RECOVERY_CODE_PEPPER=");
    expect(compose).toContain("mailpit:");
    expect(compose).toContain('"8025:8025"');
  });

  it("keeps generated Prisma files out of Git while tracking safe examples", () => {
    const ignore = readFileSync(".gitignore", "utf8");

    expect(ignore).toContain("/src/generated/prisma");
    expect(ignore).toContain("!.env.example");
    expect(ignore).toContain("!.env.test.example");
  });
});

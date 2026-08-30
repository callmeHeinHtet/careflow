import { describe, expect, it } from "vitest";
import { readServerEnv } from "../../src/server/env";

describe("server environment", () => {
  it("rejects a missing database URL without exposing a raw Zod error", () => {
    expect(() => readServerEnv({})).toThrow("Invalid server environment: DATABASE_URL");
  });

  it("rejects non-PostgreSQL URLs", () => {
    expect(() => readServerEnv({ DATABASE_URL: "https://example.com/database" })).toThrow(
      "Invalid server environment: DATABASE_URL",
    );
  });

  it("accepts a PostgreSQL connection string", () => {
    const result = readServerEnv({
      DATABASE_URL: "postgresql://user:password@127.0.0.1:5432/careflow",
    });

    expect(result.DATABASE_URL).toContain("postgresql://");
  });
});

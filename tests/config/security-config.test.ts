import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("production response security", () => {
  it("sets browser security headers for every application route", () => {
    const source = readFileSync("next.config.ts", "utf8");
    for (const header of ["Content-Security-Policy", "Strict-Transport-Security", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy"]) {
      expect(source).toContain(header);
    }
    expect(source).toContain("frame-ancestors 'none'");
  });
});

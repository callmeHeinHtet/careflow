import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("production verification automation", () => {
  it("provides a complete local verification command", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.scripts.typecheck).toBe("tsc --noEmit");
    expect(pkg.scripts.verify).toContain("npm run build");
    expect(pkg.scripts.verify).toContain("npm audit --audit-level=high");
  });

  it("runs migrations, tests, lint, typecheck, build, and audit in GitHub Actions", () => {
    const path = ".github/workflows/ci.yml";
    expect(existsSync(path)).toBe(true);
    const source = readFileSync(path, "utf8");
    for (const command of ["prisma migrate deploy", "npm test", "test:integration", "npm run lint", "npm run typecheck", "npm run build", "npm audit --audit-level=high"]) {
      expect(source).toContain(command);
    }
  });
});

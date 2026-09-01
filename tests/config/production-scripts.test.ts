import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("production verification automation", () => {
  it("provides a complete local verification command", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.scripts.typecheck).toBe("next typegen && tsc --noEmit");
    expect(pkg.scripts["test:e2e:local"]).toContain("playwright test");
    expect(pkg.scripts.verify).toContain("npm run build");
    expect(pkg.scripts.verify).toContain("npm run test:e2e:local");
    expect(pkg.scripts.verify).toContain("npm audit --audit-level=high");
  });

  it("runs migrations, tests, browser journeys, lint, typecheck, build, and audit in GitHub Actions", () => {
    const path = ".github/workflows/ci.yml";
    expect(existsSync(path)).toBe(true);
    const source = readFileSync(path, "utf8");
    for (const command of ["prisma migrate deploy", "npm test", "test:integration", "npm run lint", "npm run typecheck", "npm run build", "playwright install --with-deps chromium", "npm run test:e2e", "npm audit --audit-level=high"]) {
      expect(source).toContain(command);
    }
    expect(source).toContain("axllent/mailpit");
    expect(source).toContain("actions/upload-artifact@v7");
    expect(source).toContain("playwright-report");
  });

  it("runs GitHub Actions when the active master branch is pushed", () => {
    const source = readFileSync(".github/workflows/ci.yml", "utf8");
    expect(source).toMatch(/branches:\s*\[[^\]]*\bmaster\b[^\]]*\]/);
  });
});

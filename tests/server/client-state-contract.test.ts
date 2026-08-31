import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("client state boundary", () => {
  it("does not use demo seed or browser storage as an operational datastore", () => {
    const source = readFileSync("src/components/careflow/careflow-app.tsx", "utf8");
    expect(source).not.toContain("createDemoState");
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("../../lib/domain");
    expect(source).toContain('/api/workspace');
  });
});

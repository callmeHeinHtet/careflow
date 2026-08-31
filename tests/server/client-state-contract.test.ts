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

  it("connects patient registration, demographic editing, and queue priority to server mutations", () => {
    const source = readFileSync("src/components/careflow/careflow-app.tsx", "utf8");
    expect(source).toContain('mutate("PATCH"');
    expect(source).toContain('/api/patients');
    expect(source).toContain('/api/visits/${patient.visitId}');
    expect(source).toContain("PatientRegistrationDialog");
    expect(source).toContain("PatientEditDialog");
  });

  it("loads active departments into the server-authoritative workspace", () => {
    const source = readFileSync("src/server/repositories/workspace-repository.ts", "utf8");
    expect(source).toContain("db.department.findMany");
    expect(source).toContain("departments:");
  });

  it("renders operational sections from the workspace instead of hard-coded reference rows", () => {
    const viewSource = readFileSync("src/components/careflow/support-views.tsx", "utf8");
    const repositorySource = readFileSync("src/server/repositories/workspace-repository.ts", "utf8");
    expect(viewSource).not.toContain("const content =");
    expect(viewSource).not.toContain("Dr. May Thandar");
    expect(viewSource).toContain("data: DemoState");
    expect(repositorySource).toContain("db.staffProfile.findMany");
    expect(repositorySource).toContain("staff:");
    expect(repositorySource).toContain("services:");
  });
});

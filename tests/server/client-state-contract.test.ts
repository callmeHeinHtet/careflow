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

  it("uses the server snapshot time instead of hard-coded dashboard dates", () => {
    const shell = readFileSync("src/components/careflow/app-shell.tsx", "utf8");
    const overview = readFileSync("src/components/careflow/overview-view.tsx", "utf8");
    const repository = readFileSync("src/server/repositories/workspace-repository.ts", "utf8");
    expect(shell).not.toContain("31 Aug 2026");
    expect(overview).not.toContain("30 August 2026");
    expect(repository).toContain("generatedAt:");
  });

  it("mounts the operational consultation queue for doctors", () => {
    const app = readFileSync("src/components/careflow/careflow-app.tsx", "utf8");
    const constants = readFileSync("src/components/careflow/constants.tsx", "utf8");
    expect(app).toContain("<ConsultationView patients={data.patients}");
    expect(constants).toContain('id: "consultation", label: "Consultations"');
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const requiredModels = [
  "Department",
  "Patient",
  "PatientAllergy",
  "Visit",
  "TriageObservation",
  "Consultation",
  "LabOrder",
  "Medication",
  "Prescription",
  "InventoryLot",
  "InventoryTransaction",
  "Invoice",
  "InvoiceLine",
  "Payment",
  "AuditEvent",
];

describe("CareFlow Prisma schema", () => {
  it("defines every operational model", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");

    for (const model of requiredModels) {
      expect(schema).toContain(`model ${model} {`);
    }
  });

  it("includes concurrency and query constraints", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");

    expect(schema).toMatch(/model Visit \{[\s\S]*version\s+Int\s+@default\(1\)/);
    expect(schema).toMatch(/queueToken\s+String\s+@unique/);
    expect(schema).toContain("@@index([stage, priority, arrivedAt])");
    expect(schema).toContain("@@index([lastName, firstName])");
  });
});

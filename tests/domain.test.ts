import { describe, expect, it } from "vitest";
import {
  completeConsultation,
  createAuditEntry,
  dispensePrescription,
  payBill,
  orderQueue,
  submitTriage,
} from "../src/lib/domain";
import { createDemoState } from "../src/lib/seed";

describe("CareFlow domain transitions", () => {
  it("submits triage and advances a waiting patient", () => {
    const state = createDemoState();
    const result = submitTriage(state, {
      patientId: "p-1001",
      temperature: "38.1",
      bloodPressure: "128/82",
      heartRate: "96",
      spo2: "98",
      symptoms: "Fever and fatigue",
      notes: "Hydration advised",
      priority: "urgent",
      actor: "Nurse Maya",
    });
    expect(result.patient.stage).toBe("consultation");
    expect(result.patient.priority).toBe("urgent");
    expect(result.audit.at(-1)?.action).toBe("Triage recorded");
  });

  it("completes a consultation with medicine and lab requests", () => {
    const state = createDemoState();
    state.patients.find((patient) => patient.id === "p-1002")!.stage = "consultation";
    const result = completeConsultation(state, {
      patientId: "p-1002",
      findings: "Mild upper respiratory symptoms",
      diagnosis: "Viral upper respiratory infection",
      prescriptions: [{ medicineId: "med-paracetamol", quantity: 10, directions: "1 tablet every 8 hours" }],
      labs: ["CBC"],
      followUp: "2026-09-04",
      actor: "Dr. Aye",
    });
    expect(result.patient.stage).toBe("pharmacy");
    expect(result.patient.prescriptions).toHaveLength(1);
    expect(result.patient.labs).toEqual(["CBC"]);
  });

  it("rejects dispensing an allergic medicine", () => {
    const state = createDemoState();
    state.patients.find((patient) => patient.id === "p-1004")!.allergies = ["Ibuprofen"];
    expect(() => dispensePrescription(state, { patientId: "p-1004", medicineId: "med-ibuprofen", quantity: 10, actor: "Pharmacist Lin" })).toThrow(/allergy/i);
  });

  it("rejects dispensing more stock than available", () => {
    const state = createDemoState();
    expect(() => dispensePrescription(state, { patientId: "p-1004", medicineId: "med-ibuprofen", quantity: 999, actor: "Pharmacist Lin" })).toThrow(/stock/i);
  });

  it("dispenses valid medicine and advances the patient to billing", () => {
    const state = createDemoState();
    const before = state.inventory.find((item) => item.id === "med-ibuprofen")!.stock;
    const result = dispensePrescription(state, { patientId: "p-1004", medicineId: "med-ibuprofen", quantity: 10, actor: "Pharmacist Lin" });
    expect(result.patient.stage).toBe("billing");
    expect(result.inventory.find((item) => item.id === "med-ibuprofen")?.stock).toBe(before - 10);
  });

  it("pays a bill and discharges the patient", () => {
    const state = createDemoState();
    const result = payBill(state, { patientId: "p-1005", actor: "Cashier June", method: "Cash" });
    expect(result.patient.stage).toBe("discharged");
    expect(result.patient.billing.status).toBe("paid");
  });

  it("guards invalid transitions", () => {
    const state = createDemoState();
    expect(() => payBill(state, { patientId: "p-1001", actor: "Cashier June", method: "Cash" })).toThrow(/stage/i);
  });

  it("orders queue by priority then arrival", () => {
    const state = createDemoState();
    const ordered = orderQueue(state.patients.filter((patient) => patient.stage === "waiting"));
    expect(ordered.map((patient) => patient.id)).toEqual(["p-1001", "p-1003"]);
  });

  it("creates an append-only audit entry with actor and role", () => {
    const entry = createAuditEntry({ actor: "Admin Sol", role: "Admin", action: "Demo reset", patientId: null, details: "Seed restored" });
    expect(entry.id).toMatch(/^audit-/);
    expect(entry.role).toBe("Admin");
    expect(entry.timestamp).toBeTruthy();
  });
});

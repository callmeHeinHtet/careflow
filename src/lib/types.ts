export type Role = "Reception" | "Nurse" | "Doctor" | "Pharmacy" | "Cashier" | "Admin";
export type Stage = "registration" | "waiting" | "triage" | "consultation" | "pharmacy" | "billing" | "discharged";
export type Priority = "routine" | "soon" | "urgent" | "critical";

export type AuditEntry = {
  id: string;
  actor: string;
  role: Role;
  action: string;
  patientId: string | null;
  timestamp: string;
  details: string;
};

export type Prescription = { id?: string; medicineId: string; quantity: number; directions: string; status: "ordered" | "dispensed" };
export type Billing = { consultation: number; labs: number; medication: number; status: "unpaid" | "paid" };
export type Patient = {
  id: string; visitId?: string; visitVersion?: number; invoiceVersion?: number; queueNumber: string; name: string; age: number; sex: "F" | "M" | "OTHER"; phone: string; address: string;
  allergies: string[]; department: string; stage: Stage; priority: Priority; arrival: string; symptoms: string;
  vitals?: { temperature: string; bloodPressure: string; heartRate: string; spo2: string };
  triageNotes?: string; findings?: string; diagnosis?: string; prescriptions: Prescription[]; labs: string[]; followUp?: string; billing: Billing;
};
export type InventoryItem = { id: string; name: string; form: string; stock: number; reorderAt: number; expiry: string; unitPrice: number };
export type DemoState = { patients: Patient[]; inventory: InventoryItem[]; labServices: { id: string; name: string }[]; audit: AuditEntry[] };

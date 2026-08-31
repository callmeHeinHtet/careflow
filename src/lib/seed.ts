import type { DemoState } from "./types";

const patient = (data: Partial<DemoState["patients"][number]> & Pick<DemoState["patients"][number], "id" | "queueNumber" | "name" | "age" | "sex" | "stage" | "priority" | "department" | "symptoms">): DemoState["patients"][number] => ({
  phone: "09 420 555 010", address: "12 Cedar Lane, fictional district", allergies: [], arrival: "08:12", prescriptions: [], labs: [], billing: { consultation: 12000, labs: 0, medication: 0, status: "unpaid" }, ...data,
});

export function createDemoState(): DemoState {
  return {
    labServices: [],
    departments: [],
    patients: [
      patient({ id: "p-1001", queueNumber: "Q-018", name: "May Thiri Aung", age: 29, sex: "F", stage: "waiting", priority: "urgent", department: "General medicine", symptoms: "Fever and fatigue", arrival: "08:12", allergies: ["Penicillin"] }),
      patient({ id: "p-1002", queueNumber: "Q-019", name: "Ko Min Htet", age: 42, sex: "M", stage: "triage", priority: "soon", department: "General medicine", symptoms: "Persistent cough", arrival: "08:24", allergies: ["Amoxicillin"] }),
      patient({ id: "p-1003", queueNumber: "Q-020", name: "Ei Ei Win", age: 7, sex: "F", stage: "waiting", priority: "routine", department: "Pediatrics", symptoms: "Sore throat", arrival: "08:31" }),
      patient({ id: "p-1004", queueNumber: "Q-017", name: "U Hla Tun", age: 64, sex: "M", stage: "pharmacy", priority: "soon", department: "General medicine", symptoms: "Knee pain", arrival: "07:46", prescriptions: [{ medicineId: "med-ibuprofen", quantity: 10, directions: "1 tablet after food", status: "ordered" }], diagnosis: "Mechanical knee pain", billing: { consultation: 12000, labs: 0, medication: 2500, status: "unpaid" } }),
      patient({ id: "p-1005", queueNumber: "Q-016", name: "Nandar Moe", age: 35, sex: "F", stage: "billing", priority: "routine", department: "General medicine", symptoms: "Headache", arrival: "07:22", diagnosis: "Tension headache", billing: { consultation: 12000, labs: 8000, medication: 4000, status: "unpaid" } }),
      patient({ id: "p-1006", queueNumber: "Q-011", name: "Thant Zin", age: 51, sex: "M", stage: "discharged", priority: "routine", department: "Orthopedics", symptoms: "Back strain", arrival: "06:40", diagnosis: "Acute lumbar strain", billing: { consultation: 12000, labs: 0, medication: 3000, status: "paid" } }),
      patient({ id: "p-1007", queueNumber: "Q-015", name: "Su Su Lwin", age: 38, sex: "F", stage: "consultation", priority: "soon", department: "Cardiology", symptoms: "Palpitations", arrival: "07:05", triageNotes: "Vitals stable; ECG requested" }),
      patient({ id: "p-1008", queueNumber: "Q-014", name: "Aung Ko Ko", age: 47, sex: "M", stage: "discharged", priority: "routine", department: "ENT", symptoms: "Ear discomfort", arrival: "06:58", diagnosis: "Cerumen impaction", billing: { consultation: 12000, labs: 0, medication: 0, status: "paid" } }),
    ],
    inventory: [
      { id: "med-paracetamol", name: "Paracetamol 500 mg", form: "Tablet", stock: 86, reorderAt: 30, expiry: "2027-02-14", unitPrice: 250 },
      { id: "med-amoxicillin", name: "Amoxicillin 500 mg", form: "Capsule", stock: 24, reorderAt: 30, expiry: "2026-10-03", unitPrice: 650 },
      { id: "med-ibuprofen", name: "Ibuprofen 200 mg", form: "Tablet", stock: 12, reorderAt: 20, expiry: "2026-09-18", unitPrice: 250 },
      { id: "med-oral-rehydration", name: "Oral rehydration salts", form: "Sachet", stock: 44, reorderAt: 20, expiry: "2027-01-28", unitPrice: 300 },
    ],
    audit: [
      { id: "audit-001", actor: "Reception Aye", role: "Reception", action: "Registered patient", patientId: "p-1001", timestamp: "08:12", details: "Created visit Q-018 for General medicine" },
      { id: "audit-002", actor: "Nurse Maya", role: "Nurse", action: "Called next patient", patientId: "p-1002", timestamp: "08:26", details: "Moved Q-019 to triage" },
      { id: "audit-003", actor: "Dr. Aye", role: "Doctor", action: "Completed consultation", patientId: "p-1004", timestamp: "08:48", details: "Added prescription for knee pain" },
    ],
  };
}

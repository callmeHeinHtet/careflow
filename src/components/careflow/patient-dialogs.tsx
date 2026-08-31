"use client";

import { useState } from "react";
import type { DepartmentOption, Patient, Priority } from "../../lib/types";
import { priorityLabel } from "./constants";
import { Field, Modal } from "./workflow-dialogs";

type RegistrationInput = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: Patient["sex"];
  phone: string;
  address: string;
  allergies: { substance: string }[];
  departmentId: string;
  symptoms: string;
  priority: Uppercase<Priority>;
};

type DemographicsInput = Pick<RegistrationInput, "firstName" | "lastName" | "dateOfBirth" | "sex" | "phone" | "address" | "allergies">;

function allergyList(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))].map((substance) => ({ substance }));
}

export function PatientRegistrationDialog({ departments, busy, onClose, onSave }: { departments: DepartmentOption[]; busy: boolean; onClose: () => void; onSave: (input: RegistrationInput) => void }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", dateOfBirth: "", sex: "F" as Patient["sex"], phone: "", address: "", allergies: "", departmentId: departments[0]?.id ?? "", symptoms: "", priority: "routine" as Priority });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const ready = form.firstName.trim() && form.lastName.trim() && form.dateOfBirth && form.phone.trim() && form.address.trim() && form.departmentId && form.symptoms.trim();

  return <Modal title="Register patient" subtitle="Create the patient record and today’s queue visit together." kicker="Reception" onClose={onClose}>
    <div className="form-grid"><Field label="First name" value={form.firstName} onChange={(value) => set("firstName", value)} required /><Field label="Last name" value={form.lastName} onChange={(value) => set("lastName", value)} required /><Field label="Date of birth" type="date" value={form.dateOfBirth} onChange={(value) => set("dateOfBirth", value)} required /><label className="field"><span>Sex<em>required</em></span><select value={form.sex} onChange={(event) => set("sex", event.target.value)}><option value="F">Female</option><option value="M">Male</option><option value="OTHER">Other</option></select></label><Field label="Phone" value={form.phone} onChange={(value) => set("phone", value)} required /><label className="field"><span>Department<em>required</em></span><select value={form.departmentId} onChange={(event) => set("departmentId", event.target.value)}>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label></div>
    <Field label="Address" value={form.address} onChange={(value) => set("address", value)} required />
    <Field label="Allergies" value={form.allergies} onChange={(value) => set("allergies", value)} placeholder="Comma-separated; leave blank if none" />
    <Field label="Reason for visit" value={form.symptoms} onChange={(value) => set("symptoms", value)} textarea required />
    <label className="field"><span>Initial priority<em>required</em></span><select value={form.priority} onChange={(event) => set("priority", event.target.value)}>{Object.keys(priorityLabel).map((priority) => <option key={priority} value={priority}>{priorityLabel[priority as Priority]}</option>)}</select></label>
    <div className="modal-actions"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={!ready || busy} onClick={() => onSave({ ...form, allergies: allergyList(form.allergies), priority: form.priority.toUpperCase() as Uppercase<Priority> })}>Register patient</button></div>
  </Modal>;
}

export function PatientEditDialog({ patient, busy, onClose, onSave }: { patient: Patient; busy: boolean; onClose: () => void; onSave: (input: DemographicsInput) => void }) {
  const [form, setForm] = useState({ firstName: patient.firstName ?? patient.name.split(" ")[0] ?? "", lastName: patient.lastName ?? patient.name.split(" ").slice(1).join(" "), dateOfBirth: patient.dateOfBirth ?? "", sex: patient.sex, phone: patient.phone, address: patient.address, allergies: patient.allergies.join(", ") });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const ready = form.firstName.trim() && form.lastName.trim() && form.dateOfBirth && form.phone.trim() && form.address.trim();

  return <Modal title="Edit demographics" subtitle={`${patient.queueNumber} · ${patient.name}`} kicker="Patient record" onClose={onClose}>
    <div className="form-grid"><Field label="First name" value={form.firstName} onChange={(value) => set("firstName", value)} required /><Field label="Last name" value={form.lastName} onChange={(value) => set("lastName", value)} required /><Field label="Date of birth" type="date" value={form.dateOfBirth} onChange={(value) => set("dateOfBirth", value)} required /><label className="field"><span>Sex<em>required</em></span><select value={form.sex} onChange={(event) => set("sex", event.target.value)}><option value="F">Female</option><option value="M">Male</option><option value="OTHER">Other</option></select></label><Field label="Phone" value={form.phone} onChange={(value) => set("phone", value)} required /><Field label="Address" value={form.address} onChange={(value) => set("address", value)} required /></div>
    <Field label="Allergies" value={form.allergies} onChange={(value) => set("allergies", value)} placeholder="Comma-separated; leave blank if none" />
    <div className="modal-actions"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={!ready || busy} onClick={() => onSave({ ...form, allergies: allergyList(form.allergies) })}>Save changes</button></div>
  </Modal>;
}

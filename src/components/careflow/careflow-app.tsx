"use client";

import { useMemo, useState } from "react";
import type { DemoState, Patient, Prescription, Priority, Role } from "../../lib/types";
import { AppShell } from "./app-shell";
import { type ViewId } from "./constants";
import { OverviewView } from "./overview-view";
import { PatientEditDialog, PatientRegistrationDialog } from "./patient-dialogs";
import { PatientDrawer } from "./patient-drawer";
import { PatientsView } from "./patients-view";
import { DoctorRosterView, ReferenceSectionView } from "./support-views";
import { ConsultationDialog, TriageDialog } from "./workflow-dialogs";
import { AuditView, BillingView, PharmacyView, QueueView, TriageView } from "./workspace-views";

type MutationMethod = "POST" | "PATCH";

export function CareFlowApp({ role, displayName, initialData }: { role: Role; displayName: string; initialData: DemoState }) {
  const [data, setData] = useState(initialData);
  const [view, setView] = useState<ViewId>("overview");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [triageOpen, setTriageOpen] = useState(false);
  const [consultOpen, setConsultOpen] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const patients = useMemo(() => data.patients.filter((patient) => `${patient.name} ${patient.queueNumber} ${patient.department}`.toLowerCase().includes(query.toLowerCase())), [data.patients, query]);
  const queue = useMemo(() => data.patients.filter((patient) => ["waiting", "triage"].includes(patient.stage)).sort((a, b) => ({ critical: 0, urgent: 1, soon: 2, routine: 3 })[a.priority] - ({ critical: 0, urgent: 1, soon: 2, routine: 3 })[b.priority] || a.arrival.localeCompare(b.arrival)), [data.patients]);
  const active = selectedId ? data.patients.find((patient) => patient.id === selectedId) ?? null : null;
  const can = (roles: Role[]) => roles.includes(role) || role === "Admin";
  const total = (patient: Patient) => patient.billing.consultation + patient.billing.labs + patient.billing.medication;
  const dateLabel = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", weekday: "short" }).format(new Date(data.generatedAt));

  const refresh = async () => {
    const response = await fetch("/api/workspace", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not refresh the workspace");
    setData((await response.json()).data as DemoState);
  };

  const closeWorkflows = () => {
    setSelectedId(null);
    setTriageOpen(false);
    setConsultOpen(false);
    setRegistrationOpen(false);
    setEditOpen(false);
  };

  const mutate = async (method: MutationMethod, path: string, body: unknown, message: string) => {
    setBusy(true);
    try {
      const response = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "The action could not be completed");
      await refresh();
      closeWorkflows();
      setNotice(message);
      window.setTimeout(() => setNotice(""), 4000);
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const open = (patient: Patient) => setSelectedId(patient.id);
  const openTriage = (patient: Patient) => { setSelectedId(patient.id); setTriageOpen(true); };
  const updatePriority = (patient: Patient, priority: Priority) => {
    if (patient.visitId && patient.visitVersion) void mutate("PATCH", `/api/visits/${patient.visitId}`, { version: patient.visitVersion, priority: priority.toUpperCase() }, `${patient.name} priority updated`);
  };
  const dispense = (patient: Patient, prescription: Prescription) => {
    if (patient.visitId && patient.visitVersion && prescription.id) void mutate("POST", `/api/visits/${patient.visitId}/dispense`, { version: patient.visitVersion, prescriptionId: prescription.id }, "Prescription dispensed");
  };
  const pay = (patient: Patient) => {
    if (patient.visitId && patient.visitVersion && patient.invoiceVersion) void mutate("POST", `/api/visits/${patient.visitId}/payment`, { visitVersion: patient.visitVersion, invoiceVersion: patient.invoiceVersion, method: "CASH" }, `${patient.name} paid and discharged`);
  };

  const content = view === "overview"
    ? <OverviewView data={data} queue={queue} onView={setView} onSelect={open} />
    : view === "patients"
      ? <PatientsView patients={patients} query={query} onSelect={open} onRegister={() => setRegistrationOpen(true)} canRegister={can(["Reception"])} />
      : view === "queue"
        ? <QueueView patients={queue} onSelect={open} onTriage={openTriage} onPriority={updatePriority} busy={busy} can={can} />
        : view === "triage"
          ? <TriageView patients={data.patients} onSelect={openTriage} />
          : view === "consultation"
            ? <DoctorRosterView data={data} />
            : view === "pharmacy"
              ? <PharmacyView data={data} onSelect={open} can={can} onDispense={dispense} busy={busy} />
              : view === "billing"
                ? <BillingView data={data} onSelect={open} can={can} onPay={pay} busy={busy} total={total} />
                : view === "audit"
                  ? <AuditView data={data} />
                  : <ReferenceSectionView view={view as "appointments" | "services" | "analytics" | "users" | "departments" | "settings"} data={data} />;

  return <AppShell view={view} setView={setView} role={role} displayName={displayName} dateLabel={dateLabel} query={query} setQuery={setQuery} mobileNav={mobileNav} setMobileNav={setMobileNav} queueCount={queue.length} patients={data.patients} notice={notice}>
    {content}
    {active && !triageOpen && !consultOpen && !editOpen && <PatientDrawer patient={active} onClose={() => setSelectedId(null)} onEdit={() => setEditOpen(true)} onTriage={() => setTriageOpen(true)} onConsult={() => setConsultOpen(true)} onView={setView} can={can} />}
    {registrationOpen && <PatientRegistrationDialog departments={data.departments} busy={busy} onClose={() => setRegistrationOpen(false)} onSave={(form) => void mutate("POST", "/api/patients", form, `${form.firstName} ${form.lastName} registered`)} />}
    {active && editOpen && <PatientEditDialog patient={active} busy={busy} onClose={() => setEditOpen(false)} onSave={(form) => { if (active.patientVersion) void mutate("PATCH", `/api/patients/${active.id}`, { ...form, version: active.patientVersion }, `${active.name} demographics updated`); }} />}
    {active && triageOpen && <TriageDialog patient={active} onClose={() => setTriageOpen(false)} onSave={(form) => { if (active.visitId && active.visitVersion) void mutate("POST", `/api/visits/${active.visitId}/triage`, { version: active.visitVersion, temperature: Number(form.temperature), bloodPressure: form.bloodPressure, heartRate: Number(form.heartRate), oxygenSat: Number(form.spo2), symptoms: form.symptoms, notes: form.notes, priority: form.priority.toUpperCase() }, `${active.name} advanced to consultation`); }} />}
    {active && consultOpen && <ConsultationDialog patient={active} data={data} onClose={() => setConsultOpen(false)} onSave={(form) => { if (active.visitId && active.visitVersion) void mutate("POST", `/api/visits/${active.visitId}/consultation`, { ...form, version: active.visitVersion }, `${active.name} consultation completed`); }} />}
  </AppShell>;
}

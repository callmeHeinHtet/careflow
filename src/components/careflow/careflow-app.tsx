"use client";

import { useEffect, useMemo, useState } from "react";
import { completeConsultation, orderQueue, submitTriage } from "../../lib/domain";
import { createDemoState } from "../../lib/seed";
import type { DemoState, Patient, Role } from "../../lib/types";
import { AppShell } from "./app-shell";
import { type ViewId } from "./constants";
import { OverviewView } from "./overview-view";
import { PatientDrawer } from "./patient-drawer";
import { PatientsView } from "./patients-view";
import { DoctorRosterView, ReferenceSectionView } from "./support-views";
import { ConsultationDialog, TriageDialog } from "./workflow-dialogs";
import { AuditView, BillingView, PharmacyView, QueueView, TriageView } from "./workspace-views";

export function CareFlowApp() {
  const [data, setData] = useState<DemoState>(() => createDemoState()); const [hydrated, setHydrated] = useState(false); const [role, setRole] = useState<Role>("Nurse"); const [view, setView] = useState<ViewId>("overview"); const [query, setQuery] = useState(""); const [selectedId, setSelectedId] = useState<string | null>(null); const [notice, setNotice] = useState(""); const [mobileNav, setMobileNav] = useState(false); const [triageOpen, setTriageOpen] = useState(false); const [consultOpen, setConsultOpen] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => { const saved = localStorage.getItem("careflow-demo-state"); if (saved) { try { const parsed = JSON.parse(saved) as DemoState; const seed = createDemoState(); const missingPatients = seed.patients.filter((patient) => !parsed.patients.some((savedPatient) => savedPatient.id === patient.id)); setData({ ...parsed, patients: [...parsed.patients, ...missingPatients] }); } catch { localStorage.removeItem("careflow-demo-state"); } } setHydrated(true); }, 0); return () => window.clearTimeout(timer); }, []);
  useEffect(() => { if (hydrated) localStorage.setItem("careflow-demo-state", JSON.stringify(data)); }, [data, hydrated]);
  const patients = useMemo(() => data.patients.filter((patient) => `${patient.name} ${patient.queueNumber} ${patient.department}`.toLowerCase().includes(query.toLowerCase())), [data.patients, query]); const queue = useMemo(() => orderQueue(data.patients.filter((patient) => ["waiting", "triage"].includes(patient.stage))), [data.patients]); const activePatient = selectedId ? data.patients.find((patient) => patient.id === selectedId) ?? null : null;
  const can = (needed: Role[]) => needed.includes(role) || role === "Admin"; const update = (state: DemoState, message: string) => { setData(state); setNotice(message); setSelectedId(null); setTriageOpen(false); setConsultOpen(false); window.setTimeout(() => setNotice(""), 4000); }; const reset = () => { if (window.confirm("Reset the fictional demo records to their starting state?")) { setData(createDemoState()); setNotice("Demo records reset"); } }; const total = (patient: Patient) => patient.billing.consultation + patient.billing.labs + patient.billing.medication;
  const open = (patient: Patient) => setSelectedId(patient.id); const openTriage = (patient: Patient) => { setSelectedId(patient.id); setTriageOpen(true); };
  const content = (() => {
    switch (view) {
      case "overview": return <OverviewView data={data} queue={queue} onView={setView} onSelect={open} />;
      case "appointments": return <ReferenceSectionView view="appointments" />;
      case "patients": return <PatientsView patients={patients} query={query} onSelect={open} />;
      case "queue": return <QueueView patients={queue} onSelect={open} onTriage={openTriage} can={can} />;
      case "triage": return <TriageView patients={data.patients} onSelect={openTriage} />;
      case "consultation": return <DoctorRosterView data={data} />;
      case "pharmacy": return <PharmacyView data={data} onSelect={open} can={can} update={update} />;
      case "billing": return <BillingView data={data} onSelect={open} can={can} update={update} total={total} />;
      case "services": return <ReferenceSectionView view="services" />;
      case "audit": return <AuditView data={data} />;
      case "analytics": return <ReferenceSectionView view="analytics" />;
      case "users": return <ReferenceSectionView view="users" />;
      case "departments": return <ReferenceSectionView view="departments" />;
      case "settings": return <ReferenceSectionView view="settings" />;
    }
  })();
  return <AppShell view={view} setView={setView} role={role} setRole={setRole} query={query} setQuery={setQuery} mobileNav={mobileNav} setMobileNav={setMobileNav} reset={reset} queueCount={queue.length} patients={data.patients} notice={notice}>{content}{activePatient && !triageOpen && !consultOpen && <PatientDrawer patient={activePatient} onClose={() => setSelectedId(null)} onTriage={() => setTriageOpen(true)} onConsult={() => setConsultOpen(true)} onView={setView} can={can} />}{activePatient && triageOpen && <TriageDialog patient={activePatient} onClose={() => setTriageOpen(false)} onSave={(form) => { const result = submitTriage(data, { ...form, patientId: activePatient.id, actor: "Nurse Maya" }); update(result.state, `${activePatient.name} advanced to consultation`); }} />}{activePatient && consultOpen && <ConsultationDialog patient={activePatient} data={data} onClose={() => setConsultOpen(false)} onSave={(form) => { const result = completeConsultation(data, { ...form, patientId: activePatient.id, actor: "Dr. Aye" }); update(result.state, `${activePatient.name} consultation completed`); }} />}</AppShell>;
}

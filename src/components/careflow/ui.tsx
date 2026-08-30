import { ArrowRight, ClipboardList } from "lucide-react";
import type { ReactNode } from "react";
import type { Patient, Priority, Stage } from "../../lib/types";
import { priorityLabel, stageLabel, stageOrder } from "./constants";
import type { ViewId } from "./constants";

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`priority priority-${priority}`}><span className="priority-dot" aria-hidden="true" />{priorityLabel[priority]}</span>;
}

export function Masthead({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  const referenceCopy: Record<string, { title: string; detail: string }> = {
    "Live queue": { title: "Patient Queue", detail: "Priority-sorted patients currently moving through OPD." },
    Triage: { title: "OPD Schedule", detail: "Today’s outpatient flow and triage schedule." },
    Pharmacy: { title: "Inventory", detail: "Monitor medicine stock and fulfill prescriptions." },
    "Audit trail": { title: "Daily Summary", detail: "A concise record of today’s operational activity." },
  };
  const copy = referenceCopy[title] ?? { title, detail: detail ?? "" };
  return <div className="masthead"><div><h1>{copy.title}</h1>{copy.detail && <p className="muted masthead-detail">{copy.detail}</p>}</div>{action}</div>;
}

export function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  return <div className="empty-state"><ClipboardList size={20} aria-hidden="true" /><div><strong>{text}</strong>{action}</div></div>;
}

export function JourneyRibbon({ patients, currentView, onView }: { patients: Patient[]; currentView: ViewId; onView: (view: ViewId) => void }) {
  const stageView: Record<Exclude<Stage, "waiting">, ViewId> = { registration: "queue", triage: "triage", consultation: "consultation", pharmacy: "pharmacy", billing: "billing", discharged: "patients" };
  const activeStage = currentView === "overview" || currentView === "queue" ? "registration" : currentView === "patients" ? "discharged" : currentView;
  return <section className="flow-ribbon" aria-label="Patient flow stages"><div className="flow-ribbon-head"><span>Patient flow</span><span className="mono">Live board · 08:52</span></div><div className="flow-steps">{stageOrder.map((stage, index) => {
    const count = patients.filter((patient) => (patient.stage === "waiting" ? "registration" : patient.stage) === stage).length;
    const active = activeStage === stage;
    const completed = index === 0 ? count === 0 : patients.some((patient) => stageOrder.indexOf(patient.stage === "waiting" ? "registration" : patient.stage) > index);
    return <button className={`flow-step ${active ? "active" : ""} ${completed ? "completed" : ""}`} key={stage} aria-current={active ? "step" : undefined} onClick={() => onView(stageView[stage])}><span className="flow-marker" aria-hidden="true">{completed ? "✓" : String(index + 1).padStart(2, "0")}</span><span>{stageLabel[stage]}</span><strong className="mono">{count}</strong></button>;
  })}</div></section>;
}

export function PatientJourney({ patient }: { patient: Patient }) {
  const current = stageOrder.indexOf(patient.stage === "waiting" ? "registration" : patient.stage);
  return <div className="patient-journey" aria-label={`Journey current stage ${stageLabel[patient.stage]}`}>{stageOrder.map((stage, index) => <div className={`journey-step ${index < current ? "done" : ""} ${index === current ? "current" : ""}`} key={stage}><span className="journey-marker">{index < current ? "✓" : String(index + 1).padStart(2, "0")}</span><span>{stageLabel[stage]}</span></div>)}</div>;
}

export function PatientLink({ patient, onSelect }: { patient: Patient; onSelect: (patient: Patient) => void }) {
  return <button className="patient-link" onClick={() => onSelect(patient)}><strong>{patient.name}</strong><small>{patient.queueNumber} · {patient.department}</small></button>;
}

export function RowArrow() { return <ArrowRight size={16} aria-hidden="true" />; }

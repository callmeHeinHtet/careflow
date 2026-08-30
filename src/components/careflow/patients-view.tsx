"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Download } from "lucide-react";
import type { Patient } from "../../lib/types";
import { Masthead, PriorityBadge } from "./ui";

type PatientFilter = "all" | "active" | "review";

export function PatientsView({ patients, query, onSelect }: { patients: Patient[]; query: string; onSelect: (patient: Patient) => void }) {
  const [filter, setFilter] = useState<PatientFilter>("all");
  const filtered = useMemo(() => patients.filter((patient) => {
    if (filter === "active") return patient.stage !== "discharged";
    if (filter === "review") return patient.priority === "critical" || patient.priority === "urgent";
    return true;
  }), [filter, patients]);

  const exportList = () => {
    const rows = [["Queue", "Patient", "Department", "Priority", "Stage"], ...filtered.map((patient) => [patient.queueNumber, patient.name, patient.department, patient.priority, patient.stage])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "careflow-fictional-patients.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return <>
    <Masthead title="Patients" detail={`${filtered.length} fictional records · select a patient to inspect their journey.`} action={<button className="secondary-button" onClick={exportList}><Download size={16} />Export CSV</button>} />
    <div className="filter-bar" role="group" aria-label="Filter patients">
      <span className="filter-label">Showing</span>
      <button className={`filter-chip ${filter === "all" ? "active" : ""}`} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All patients <span>{patients.length}</span></button>
      <button className={`filter-chip ${filter === "active" ? "active" : ""}`} aria-pressed={filter === "active"} onClick={() => setFilter("active")}>Active visits <span>{patients.filter((patient) => patient.stage !== "discharged").length}</span></button>
      <button className={`filter-chip ${filter === "review" ? "active" : ""}`} aria-pressed={filter === "review"} onClick={() => setFilter("review")}>Needs review <span>{patients.filter((patient) => patient.priority === "critical" || patient.priority === "urgent").length}</span></button>
      {query && <span className="muted">Search: “{query}”</span>}
    </div>
    <section className="work-surface patient-table">
      <div className="table-head"><span>Queue</span><span>Patient</span><span>Priority</span><span>Stage</span><span /></div>
      {filtered.length ? filtered.map((patient) => <button className="patient-row" key={patient.id} onClick={() => onSelect(patient)}><span className="mono queue-number">{patient.queueNumber}</span><span><strong>{patient.name}</strong><small>{patient.age} · {patient.sex} · {patient.department}</small></span><PriorityBadge priority={patient.priority} /><span className="row-stage">{patient.stage === "waiting" ? "Registration" : patient.stage}</span><ArrowRight size={16} /></button>) : <div className="empty-state">No patients match this view.</div>}
    </section>
  </>;
}
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  MoreVertical,
  PackageSearch,
  SlidersHorizontal,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { DemoState, Patient } from "../../lib/types";
import { stageLabel } from "./constants";

export function OverviewView({ data, queue, onView, onSelect }: { data: DemoState; queue: Patient[]; onView: (view: "queue" | "pharmacy" | "audit") => void; onSelect: (patient: Patient) => void }) {
  const seen = data.patients.filter((patient) => ["pharmacy", "billing", "discharged"].includes(patient.stage)).length;
  const lowStock = data.inventory.filter((medicine) => medicine.stock <= medicine.reorderAt).length;
  const departmentLoad = data.departments.map((department) => [department.name, data.patients.filter((patient) => patient.department === department.name && patient.stage !== "discharged").length, department.capacity] as const);
  const metrics = [
    { label: "Total patients", value: data.patients.length, note: "Today", Icon: UsersRound },
    { label: "Waiting now", value: queue.length, note: "In queue", Icon: UserRound },
    { label: "Seen today", value: seen, note: "Completed visits", Icon: CheckCircle2 },
    { label: "Average wait", value: "14 min", note: "Current shift", Icon: Clock3 },
  ];

  return <>
    <section className="dashboard-heading">
      <div><h1>Operations overview</h1><p>30 August 2026, Sunday <span /> Day shift · 07:00–13:00</p></div>
      <button className="secondary-button" onClick={() => onView("audit")}>View activity <ArrowUpRight size={14} /></button>
    </section>

    <section className="dashboard-metrics" aria-label="Current operations">
      {metrics.map(({ label, value, note, Icon }) => <article className="dashboard-metric" key={label}><span className="metric-icon"><Icon size={20} /></span><div><p>{label}</p><strong>{value}</strong><small>{note}</small></div></article>)}
    </section>

    <div className="dashboard-layout">
      <section className="queue-directory">
        <header className="directory-head"><div><h2>Patient queue</h2><p>Current outpatient visits</p></div><div className="directory-actions"><button className="secondary-button" onClick={() => onView("queue")}><SlidersHorizontal size={14} />Open queue</button></div></header>
        <div className="directory-columns" aria-hidden="true"><span>Token no.</span><span>Patient</span><span>Age / sex</span><span>Department</span><span>Status</span><span>Arrived</span><span /></div>
        <div className="directory-rows">
          {data.patients.map((patient) => <button className="directory-row" key={patient.id} onClick={() => onSelect(patient)}>
            <span className="token-number">{patient.queueNumber.replace("Q-", "OPD-")}</span>
            <span className="directory-patient"><strong>{patient.name}</strong><small>{patient.phone}</small></span>
            <span>{patient.age} / {patient.sex}</span>
            <span>{patient.department}</span>
            <span><i className={`stage-tag stage-${patient.stage}`}>{patient.stage === "waiting" ? "Waiting" : stageLabel[patient.stage]}</i></span>
            <span className="mono">{patient.arrival}</span>
            <span className="row-menu" aria-hidden="true"><MoreVertical size={16} /></span>
          </button>)}
        </div>
        <footer className="directory-foot"><span>Showing {data.patients.length} visits</span><button className="text-button" onClick={() => onView("queue")}>View full queue <ArrowUpRight size={13} /></button></footer>
      </section>

      <aside className="overview-rail">
        <section className="rail-panel attention-panel"><header><h2>Needs attention</h2></header><button onClick={() => onView("queue")}><span className="rail-icon critical"><Clock3 size={16} /></span><span><strong>High waiting time</strong><small>{queue.length} patients are waiting</small></span><ArrowUpRight size={14} /></button><button onClick={() => onView("pharmacy")}><span className="rail-icon warning"><PackageSearch size={16} /></span><span><strong>Low stock alert</strong><small>{lowStock} medicines need review</small></span><ArrowUpRight size={14} /></button><button onClick={() => onView("audit")}><span className="rail-icon neutral"><AlertTriangle size={16} /></span><span><strong>Review recent activity</strong><small>{data.audit.length} audit events recorded</small></span><ArrowUpRight size={14} /></button></section>
        <section className="rail-panel capacity-panel"><header><h2>Capacity overview</h2><span>Live</span></header>{departmentLoad.map(([name, used, total]) => <div className="rail-capacity" key={name}><div><strong>{name}</strong><span>{used} / {total}</span></div><div><span style={{ width: `${Math.min(100, (used / Math.max(total, 1)) * 100)}%` }} /></div></div>)}</section>
      </aside>
    </div>
  </>;
}

import {
  Activity,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Database,
  Settings2,
  ShieldCheck,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import type { DemoState } from "../../lib/types";
import type { ViewId } from "./constants";
import { stageLabel, viewCopy } from "./constants";
import { EmptyState, Masthead } from "./ui";

type ReferenceView = "appointments" | "services" | "analytics" | "users" | "departments" | "settings";
type SectionData = { Icon: typeof Activity; stats: [string, string][]; rows: [string, string, string, string][] };

function percentage(value: number, total: number) {
  return total ? `${Math.round((value / total) * 100)}%` : "0%";
}

function sectionData(view: ReferenceView, data: DemoState): SectionData {
  const completed = data.patients.filter((patient) => patient.stage === "discharged").length;
  const activeStaff = data.staff.filter((member) => member.status === "ACTIVE");
  const doctors = activeStaff.filter((member) => member.role === "Doctor");

  if (view === "appointments") {
    const checkedIn = data.patients.filter((patient) => patient.stage !== "discharged").length;
    return {
      Icon: CalendarCheck2,
      stats: [["Visits today", String(data.patients.length)], ["In clinic", String(checkedIn)], ["Completed", String(completed)]],
      rows: [...data.patients].sort((a, b) => a.arrival.localeCompare(b.arrival)).map((patient) => [patient.arrival, patient.name, patient.department, stageLabel[patient.stage]]),
    };
  }

  if (view === "services") {
    const labCount = data.services.filter((service) => service.type === "LAB").length;
    return {
      Icon: Activity,
      stats: [["Active services", String(data.services.length)], ["Laboratory", String(labCount)], ["Consultation", String(data.services.length - labCount)]],
      rows: data.services.map((service) => [service.name, service.code, service.department ?? "All departments", `${service.unitPrice.toLocaleString()} MMK`]),
    };
  }

  if (view === "analytics") {
    const activeVisits = data.patients.length - completed;
    const priorityCases = data.patients.filter((patient) => ["urgent", "critical"].includes(patient.priority)).length;
    const lowStock = data.inventory.filter((item) => item.stock <= item.reorderAt).length;
    return {
      Icon: Activity,
      stats: [["Visits loaded", String(data.patients.length)], ["Completed", String(completed)], ["Completion rate", percentage(completed, data.patients.length)]],
      rows: [
        ["Patient throughput", `${completed} completed visits`, percentage(completed, data.patients.length), `${activeVisits} active`],
        ["Priority workload", `${priorityCases} urgent or critical`, percentage(priorityCases, data.patients.length), "Current queue"],
        ["Inventory health", `${lowStock} low-stock items`, `${data.inventory.length} medicines`, lowStock ? "Review needed" : "Healthy"],
        ["Audit coverage", `${data.audit.length} recent events`, "Append-only", "Protected"],
      ],
    };
  }

  if (view === "users") {
    return {
      Icon: UsersRound,
      stats: [["Staff profiles", String(data.staff.length)], ["Active staff", String(activeStaff.length)], ["Administrators", String(data.staff.filter((member) => member.role === "Admin").length)]],
      rows: data.staff.map((member) => [member.displayName, member.role, member.department ?? "Cross-department", member.status === "ACTIVE" ? "Active" : member.status === "ON_LEAVE" ? "On leave" : "Ended"]),
    };
  }

  if (view === "departments") {
    return {
      Icon: Building2,
      stats: [["Departments", String(data.departments.length)], ["Active doctors", String(doctors.length)], ["Visits today", String(data.patients.length)]],
      rows: data.departments.map((department) => {
        const departmentDoctors = doctors.filter((member) => member.department === department.name).length;
        const departmentVisits = data.patients.filter((patient) => patient.department === department.name).length;
        return [department.name, `${departmentDoctors} doctors`, `${departmentVisits} visits`, `Capacity ${department.capacity}`];
      }),
    };
  }

  return {
    Icon: Settings2,
    stats: [["Workspace", "CareFlow"], ["Database", "PostgreSQL"], ["Audit", "Append-only"]],
    rows: [
      ["Authentication", "Invite-only access", "MFA enforced", "Configured"],
      ["Patient data", "Server-authoritative", "Version protected", "Active"],
      ["Queue ordering", "Priority then arrival", "Optimistic locking", "Active"],
      ["Clinical audit", "Immutable event history", `${data.audit.length} recent events`, "Protected"],
    ],
  };
}

export function ReferenceSectionView({ view, data }: { view: ReferenceView; data: DemoState }) {
  const section = sectionData(view, data);
  const copy = viewCopy[view as ViewId];
  const Icon = section.Icon;

  return <>
    <Masthead title={copy.title} detail={copy.detail} action={<span className="status-label"><CheckCircle2 size={14} />Database synced</span>} />
    <div className="section-stat-grid">
      {section.stats.map(([label, value]) => <article className="section-stat" key={label}><span><Icon size={16} />{label}</span><strong>{value}</strong></article>)}
    </div>
    <section className="work-surface reference-section">
      <header><div><h2>{view === "appointments" ? "Today’s registered visits" : `${copy.title} overview`}</h2><p>Current persisted workspace information</p></div><span><Database size={14} />Live data</span></header>
      {section.rows.length ? <div className="reference-table">
        {section.rows.map((row) => <div className="reference-row" key={row.join("-")}>
          <span className="reference-row-icon"><Icon size={15} /></span>
          {row.map((cell, index) => index === 0 ? <strong key={cell}>{cell}</strong> : <span key={`${cell}-${index}`}>{cell}</span>)}
        </div>)}
      </div> : <EmptyState text="No persisted records are available for this section yet." />}
    </section>
  </>;
}

export function DoctorRosterView({ data }: { data: DemoState }) {
  const waiting = data.patients.filter((patient) => ["waiting", "triage", "consultation"].includes(patient.stage)).length;
  const doctors = data.staff.filter((member) => member.role === "Doctor" && member.status === "ACTIVE");
  const coveredDepartments = new Set(doctors.map((doctor) => doctor.department).filter(Boolean)).size;
  return <>
    <Masthead title="Doctor roster" detail="Active doctor profiles and their assigned departments." action={<span className="status-label"><Stethoscope size={14} />{doctors.length} active</span>} />
    <div className="section-stat-grid"><article className="section-stat"><span><Stethoscope size={16} />Active doctors</span><strong>{doctors.length}</strong></article><article className="section-stat"><span><UsersRound size={16} />Patients in flow</span><strong>{waiting}</strong></article><article className="section-stat"><span><ShieldCheck size={16} />Departments covered</span><strong>{coveredDepartments}</strong></article></div>
    <section className="work-surface reference-section"><header><div><h2>Clinical staff directory</h2><p>Persisted active doctor assignments</p></div><span><Clock3 size={14} />Current</span></header>{doctors.length ? <div className="reference-table">{doctors.map((doctor) => <div className="reference-row" key={doctor.id}><span className="reference-row-icon"><Stethoscope size={15} /></span><strong>{doctor.displayName}</strong><span>{doctor.employeeNumber}</span><span>{doctor.department ?? "Cross-department"}</span><em>Active</em></div>)}</div> : <EmptyState text="No active doctors are assigned." />}</section>
  </>;
}

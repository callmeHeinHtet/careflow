import {
  Activity,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Settings2,
  ShieldCheck,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import type { DemoState } from "../../lib/types";
import type { ViewId } from "./constants";
import { viewCopy } from "./constants";
import { Masthead } from "./ui";

const content = {
  appointments: {
    icon: CalendarCheck2,
    stats: [["Today", "24"], ["Checked in", "18"], ["Upcoming", "6"]],
    rows: [["09:00 AM", "May Thiri Aung", "General Medicine", "Checked in"], ["09:30 AM", "Ko Min Htet", "General Medicine", "Confirmed"], ["10:00 AM", "Ei Ei Win", "Pediatrics", "Confirmed"], ["10:30 AM", "Su Su Lwin", "Cardiology", "Scheduled"]],
  },
  services: {
    icon: Activity,
    stats: [["Active services", "8"], ["Available now", "6"], ["Avg. wait", "32 min"]],
    rows: [["General Medicine", "Walk-in & follow-up", "Open", "4 doctors"], ["Pediatrics", "Walk-in & appointment", "Open", "3 doctors"], ["Cardiology", "Appointment", "Open", "2 doctors"], ["Dermatology", "Appointment", "Limited", "1 doctor"]],
  },
  analytics: {
    icon: Activity,
    stats: [["Visits today", "126"], ["Completed", "86"], ["On-time rate", "78%"]],
    rows: [["Patient throughput", "86 completed visits", "68%", "+12%"], ["Average wait time", "32 minutes", "Target 25 min", "-8 min"], ["Capacity utilization", "74% across OPD", "Healthy", "+4%"], ["Patient return rate", "18% this month", "Stable", "+1%"]],
  },
  users: {
    icon: UsersRound,
    stats: [["Active users", "34"], ["Clinical staff", "26"], ["Administrators", "3"]],
    rows: [["Dr. May Thandar", "Doctor", "General Medicine", "Active"], ["Nurse Maya", "Nurse", "OPD", "Active"], ["Pharmacist Lin", "Pharmacy", "Dispensary", "Active"], ["June Htet", "Cashier", "Billing", "Active"]],
  },
  departments: {
    icon: Building2,
    stats: [["Departments", "6"], ["Doctors on duty", "11"], ["Utilization", "74%"]],
    rows: [["General Medicine", "3 / 4 doctors", "28 patients", "75%"], ["Pediatrics", "2 / 3 doctors", "18 patients", "67%"], ["Orthopedics", "2 / 3 doctors", "15 patients", "67%"], ["Cardiology", "1 / 2 doctors", "12 patients", "50%"]],
  },
  settings: {
    icon: Settings2,
    stats: [["Workspace", "CareFlow"], ["Shift", "Morning"], ["Status", "Healthy"]],
    rows: [["Clinic profile", "CareFlow Hospital", "Configured", "Review"], ["Queue rules", "Priority then arrival", "Active", "Manage"], ["Notifications", "Clinical alerts", "Enabled", "Manage"], ["Data & privacy", "Local demo records", "Protected", "Review"]],
  },
} satisfies Partial<Record<ViewId, { icon: typeof Activity; stats: string[][]; rows: string[][] }>>;

export function ReferenceSectionView({ view }: { view: keyof typeof content }) {
  const section = content[view];
  const copy = viewCopy[view];
  const Icon = section.icon;

  return <>
    <Masthead title={copy.title} detail={copy.detail} action={<span className="status-label"><CheckCircle2 size={14} />Updated now</span>} />
    <div className="section-stat-grid">
      {section.stats.map(([label, value]) => <article className="section-stat" key={label}><span><Icon size={16} />{label}</span><strong>{value}</strong></article>)}
    </div>
    <section className="work-surface reference-section">
      <header><div><h2>{copy.title} overview</h2><p>Current morning-shift information</p></div><span><Clock3 size={14} />Live</span></header>
      <div className="reference-table">
        {section.rows.map((row) => <div className="reference-row" key={row.join("-")}>
          <span className="reference-row-icon"><Icon size={15} /></span>
          {row.map((cell, index) => index === 0 ? <strong key={cell}>{cell}</strong> : <span key={`${cell}-${index}`}>{cell}</span>)}
        </div>)}
      </div>
    </section>
  </>;
}

export function DoctorRosterView({ data }: { data: DemoState }) {
  const waiting = data.patients.filter((patient) => ["waiting", "triage", "consultation"].includes(patient.stage)).length;
  const doctors = [
    ["Dr. May Thandar", "General Medicine", "07:00 AM – 01:00 PM", "Available"],
    ["Dr. Aye Chan", "Pediatrics", "07:00 AM – 01:00 PM", "In consultation"],
    ["Dr. Min Ko", "Orthopedics", "08:00 AM – 02:00 PM", "Available"],
    ["Dr. Thazin Myint", "Cardiology", "09:00 AM – 03:00 PM", "Rounds"],
  ];
  return <>
    <Masthead title="Doctor Roster" detail="Doctors assigned to today’s clinical sessions." action={<span className="status-label"><Stethoscope size={14} />11 on duty</span>} />
    <div className="section-stat-grid"><article className="section-stat"><span><Stethoscope size={16} />Doctors on duty</span><strong>11</strong></article><article className="section-stat"><span><UsersRound size={16} />Patients in flow</span><strong>{waiting}</strong></article><article className="section-stat"><span><ShieldCheck size={16} />Coverage</span><strong>All covered</strong></article></div>
    <section className="work-surface reference-section"><header><div><h2>Morning shift</h2><p>Clinical coverage by department</p></div><span><Clock3 size={14} />07:00 AM – 01:00 PM</span></header><div className="reference-table">{doctors.map((row) => <div className="reference-row" key={row[0]}><span className="reference-row-icon"><Stethoscope size={15} /></span><strong>{row[0]}</strong><span>{row[1]}</span><span>{row[2]}</span><em>{row[3]}</em></div>)}</div></section>
  </>;
}

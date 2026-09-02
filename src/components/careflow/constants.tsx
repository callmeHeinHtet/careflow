import {
  Activity,
  BarChart3,
  Boxes,
  Building2,
  CalendarDays,
  ClipboardList,
  Clock3,
  LayoutDashboard,
  PackageSearch,
  Receipt,
  Settings,
  ShieldCheck,
  Stethoscope,
  UserCog,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";
import type { Priority, Role, Stage } from "../../lib/types";

export const roles: Role[] = ["Reception", "Nurse", "Doctor", "Pharmacy", "Cashier", "Admin"];
export const navItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "appointments", label: "Appointments", icon: CalendarDays },
  { id: "queue", label: "Patient Queue", icon: ClipboardList },
  { id: "patients", label: "Patients", icon: Users },
  { id: "billing", label: "Billing", icon: Receipt },
  { id: "pharmacy", label: "Inventory", icon: PackageSearch },
  { id: "triage", label: "OPD Schedule", icon: Clock3 },
  { id: "consultation", label: "Consultations", icon: Stethoscope },
  { id: "services", label: "Services", icon: Boxes },
  { id: "audit", label: "Daily Summary", icon: Activity },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "users", label: "Users & Roles", icon: UserCog },
  { id: "departments", label: "Departments", icon: Building2 },
  { id: "settings", label: "Settings", icon: Settings },
] satisfies { id: string; label: string; icon: ComponentType<{ size?: number }> }[];
export const stageOrder: Exclude<Stage, "waiting">[] = ["registration", "triage", "consultation", "pharmacy", "billing", "discharged"];
export const stageLabel: Record<Stage, string> = { registration: "Registration", waiting: "Waiting", triage: "Triage", consultation: "Consultation", pharmacy: "Pharmacy", billing: "Billing", discharged: "Discharged" };
export const priorityLabel: Record<Priority, string> = { critical: "Critical", urgent: "Urgent", soon: "Soon", routine: "Routine" };
export type ViewId = (typeof navItems)[number]["id"];
export const viewCopy: Record<ViewId, { title: string; detail: string }> = {
  overview: { title: "Operations overview", detail: "Today’s clinic activity at a glance." },
  appointments: { title: "Appointments", detail: "Review today’s scheduled visits and arrival status." },
  patients: { title: "Patients", detail: "Fictional records · select a patient to inspect their journey." },
  queue: { title: "Patient Queue", detail: "Priority-sorted patients currently moving through OPD." },
  triage: { title: "OPD Schedule", detail: "Today’s outpatient flow and triage schedule." },
  consultation: { title: "Doctor Roster", detail: "Doctors assigned to today’s clinical sessions." },
  pharmacy: { title: "Inventory", detail: "Monitor medicine stock and fulfill prescriptions." },
  billing: { title: "Billing", detail: "Review line items, then mark the visit paid to discharge the patient." },
  services: { title: "Services", detail: "Clinic services and current availability." },
  audit: { title: "Daily Summary", detail: "A concise record of today’s operational activity." },
  analytics: { title: "Analytics", detail: "Operational performance across the current shift." },
  users: { title: "Users & Roles", detail: "Staff access and role assignments." },
  departments: { title: "Departments", detail: "Department staffing and utilization." },
  settings: { title: "Settings", detail: "CareFlow workspace preferences." },
};
export { Activity, ShieldCheck };

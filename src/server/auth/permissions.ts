import { StaffRole } from "../../generated/prisma/client";

export const Capability = {
  DASHBOARD_READ: "DASHBOARD_READ",
  PATIENT_READ: "PATIENT_READ",
  PATIENT_REGISTER: "PATIENT_REGISTER",
  PATIENT_DEMOGRAPHICS_UPDATE: "PATIENT_DEMOGRAPHICS_UPDATE",
  QUEUE_PRIORITY_UPDATE: "QUEUE_PRIORITY_UPDATE",
  TRIAGE_READ: "TRIAGE_READ",
  TRIAGE_WRITE: "TRIAGE_WRITE",
  CONSULTATION_READ: "CONSULTATION_READ",
  CONSULTATION_WRITE: "CONSULTATION_WRITE",
  INVENTORY_READ: "INVENTORY_READ",
  INVENTORY_DISPENSE: "INVENTORY_DISPENSE",
  INVOICE_READ: "INVOICE_READ",
  INVOICE_SETTLE: "INVOICE_SETTLE",
  ADMIN_MANAGE: "ADMIN_MANAGE",
  AUDIT_READ_LIMITED: "AUDIT_READ_LIMITED",
  AUDIT_READ_ALL: "AUDIT_READ_ALL",
} as const;

export type Capability = (typeof Capability)[keyof typeof Capability];

const commonRead = [Capability.DASHBOARD_READ, Capability.PATIENT_READ] as const;
const permissionMatrix: Record<StaffRole, ReadonlySet<Capability>> = {
  [StaffRole.RECEPTION]: new Set([
    ...commonRead,
    Capability.PATIENT_REGISTER,
    Capability.PATIENT_DEMOGRAPHICS_UPDATE,
    Capability.QUEUE_PRIORITY_UPDATE,
    Capability.AUDIT_READ_LIMITED,
  ]),
  [StaffRole.NURSE]: new Set([
    ...commonRead,
    Capability.PATIENT_DEMOGRAPHICS_UPDATE,
    Capability.QUEUE_PRIORITY_UPDATE,
    Capability.TRIAGE_READ,
    Capability.TRIAGE_WRITE,
    Capability.CONSULTATION_READ,
    Capability.AUDIT_READ_LIMITED,
  ]),
  [StaffRole.DOCTOR]: new Set([
    ...commonRead,
    Capability.TRIAGE_READ,
    Capability.CONSULTATION_READ,
    Capability.CONSULTATION_WRITE,
    Capability.INVENTORY_READ,
    Capability.INVOICE_READ,
    Capability.AUDIT_READ_LIMITED,
  ]),
  [StaffRole.PHARMACY]: new Set([
    ...commonRead,
    Capability.CONSULTATION_READ,
    Capability.INVENTORY_READ,
    Capability.INVENTORY_DISPENSE,
    Capability.INVOICE_READ,
    Capability.AUDIT_READ_LIMITED,
  ]),
  [StaffRole.CASHIER]: new Set([
    ...commonRead,
    Capability.INVOICE_READ,
    Capability.INVOICE_SETTLE,
    Capability.AUDIT_READ_LIMITED,
  ]),
  [StaffRole.ADMIN]: new Set(Object.values(Capability)),
};

export function hasCapability(role: StaffRole, capability: Capability): boolean {
  return permissionMatrix[role].has(capability);
}

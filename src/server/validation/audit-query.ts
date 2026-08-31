import { z } from "zod";
import { StaffRole } from "../../generated/prisma/client";

const roleActions: Record<StaffRole, readonly string[] | null> = {
  [StaffRole.RECEPTION]: [
    "PATIENT_REGISTERED",
    "PATIENT_DEMOGRAPHICS_UPDATED",
    "VISIT_PRIORITY_UPDATED",
  ],
  [StaffRole.NURSE]: [
    "PATIENT_DEMOGRAPHICS_UPDATED",
    "VISIT_PRIORITY_UPDATED",
    "TRIAGE_RECORDED",
  ],
  [StaffRole.DOCTOR]: ["CONSULTATION_COMPLETED"],
  [StaffRole.PHARMACY]: ["PRESCRIPTION_DISPENSED"],
  [StaffRole.CASHIER]: ["INVOICE_SETTLED"],
  [StaffRole.ADMIN]: null,
};

export function auditActionsForRole(role: StaffRole): readonly string[] | null {
  return roleActions[role];
}

export const auditQuerySchema = z
  .object({
    action: z.string().trim().min(1).max(100).optional(),
    entityType: z.string().trim().min(1).max(100).optional(),
    entityId: z.string().trim().min(1).max(100).optional(),
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).transform((value) => Math.min(50, value)).default(25),
  })
  .strict();

export type AuditQueryInput = z.infer<typeof auditQuerySchema>;

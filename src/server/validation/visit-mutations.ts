import { z } from "zod";

const visitStage = z.enum([
  "REGISTRATION",
  "WAITING",
  "TRIAGE",
  "CONSULTATION",
  "PHARMACY",
  "BILLING",
  "DISCHARGED",
]);
const priority = z.enum(["ROUTINE", "SOON", "URGENT", "CRITICAL"]);

export const visitQuerySchema = z
  .object({
    stage: visitStage.optional(),
    departmentId: z.string().uuid().optional(),
    query: z.string().trim().max(100).optional(),
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).transform((value) => Math.min(25, value)).default(25),
  })
  .strict();

export const visitPrioritySchema = z
  .object({
    version: z.number().int().positive(),
    priority,
  })
  .strict();

export const triageSchema = z
  .object({
    version: z.number().int().positive(),
    temperature: z.number().finite().min(30).max(45),
    bloodPressure: z.string().trim().regex(/^\d{2,3}\/\d{2,3}$/).max(7),
    heartRate: z.number().int().min(20).max(250),
    oxygenSat: z.number().int().min(50).max(100),
    symptoms: z.string().trim().min(1).max(500),
    notes: z.string().trim().max(1_000),
    priority,
  })
  .strict();

export type VisitQueryInput = z.infer<typeof visitQuerySchema>;
export type VisitPriorityInput = z.infer<typeof visitPrioritySchema>;
export type TriageInput = z.infer<typeof triageSchema>;

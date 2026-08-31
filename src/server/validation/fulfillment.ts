import { z } from "zod";

export const dispenseSchema = z
  .object({
    version: z.number().int().positive(),
    prescriptionId: z.string().uuid(),
  })
  .strict();

export const paymentSchema = z
  .object({
    visitVersion: z.number().int().positive(),
    invoiceVersion: z.number().int().positive(),
    method: z.enum(["CASH", "CARD", "TRANSFER"]),
    reference: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export type DispenseInput = z.infer<typeof dispenseSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;

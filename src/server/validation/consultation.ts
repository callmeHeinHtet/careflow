import { z } from "zod";

const uniqueIds = (message: string) =>
  z
    .array(z.string().uuid())
    .max(20)
    .superRefine((items, context) => {
      const seen = new Set<string>();
      items.forEach((item, index) => {
        if (seen.has(item)) {
          context.addIssue({ code: "custom", message, path: [index] });
        }
        seen.add(item);
      });
    });

const prescriptionSchema = z
  .object({
    medicationId: z.string().uuid(),
    quantity: z.number().int().min(1).max(1_000),
    directions: z.string().trim().min(1).max(500),
  })
  .strict();

export const consultationSchema = z
  .object({
    version: z.number().int().positive(),
    findings: z.string().trim().min(1).max(2_000),
    diagnosis: z.string().trim().min(1).max(1_000),
    followUp: z.string().trim().max(500).nullable().optional(),
    labServiceIds: uniqueIds("Lab services must be unique").default([]),
    prescriptions: z
      .array(prescriptionSchema)
      .max(20)
      .superRefine((items, context) => {
        const seen = new Set<string>();
        items.forEach((item, index) => {
          if (seen.has(item.medicationId)) {
            context.addIssue({
              code: "custom",
              message: "Medications must be unique",
              path: [index, "medicationId"],
            });
          }
          seen.add(item.medicationId);
        });
      })
      .default([]),
  })
  .strict();

export type ConsultationInput = z.infer<typeof consultationSchema>;

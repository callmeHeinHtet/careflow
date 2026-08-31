import { z } from "zod";

const name = z.string().trim().min(1).max(80);
const phone = z.string().trim().min(5).max(30);
const address = z.string().trim().min(1).max(300);
const dateOfBirth = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
  }, "Invalid birth date")
  .refine((value) => value >= "1900-01-01" && value <= new Date().toISOString().slice(0, 10), {
    message: "Birth date must not be in the future",
  });

const allergySchema = z
  .object({
    substance: z.string().trim().min(1).max(100),
    notes: z.string().trim().max(300).optional(),
  })
  .strict();

const allergies = z
  .array(allergySchema)
  .max(20)
  .superRefine((items, context) => {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      const key = item.substance.toLocaleLowerCase("en-US");
      if (seen.has(key)) {
        context.addIssue({
          code: "custom",
          message: "Allergies must be unique",
          path: [index, "substance"],
        });
      }
      seen.add(key);
    });
  });

export const patientRegistrationSchema = z
  .object({
    firstName: name,
    lastName: name,
    dateOfBirth,
    sex: z.enum(["F", "M", "OTHER"]),
    phone,
    address,
    allergies: allergies.default([]),
    departmentId: z.string().uuid(),
    symptoms: z.string().trim().min(1).max(500),
    priority: z.enum(["ROUTINE", "SOON", "URGENT", "CRITICAL"]).default("ROUTINE"),
  })
  .strict();

export const patientUpdateSchema = z
  .object({
    version: z.number().int().positive(),
    firstName: name.optional(),
    lastName: name.optional(),
    dateOfBirth: dateOfBirth.optional(),
    sex: z.enum(["F", "M", "OTHER"]).optional(),
    phone: phone.optional(),
    address: address.optional(),
    allergies: allergies.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.firstName !== undefined ||
      value.lastName !== undefined ||
      value.dateOfBirth !== undefined ||
      value.sex !== undefined ||
      value.phone !== undefined ||
      value.address !== undefined ||
      value.allergies !== undefined,
    { message: "At least one demographic field is required" },
  );

export type PatientRegistrationInput = z.infer<typeof patientRegistrationSchema>;
export type PatientUpdateInput = z.infer<typeof patientUpdateSchema>;

import { z } from "zod";

const encryptionKeySchema = z.string().refine((value) => {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) return false;
  return Buffer.from(value, "base64").length === 32;
});

const serverEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .refine((value) => {
      const protocol = new URL(value).protocol;
      return protocol === "postgresql:" || protocol === "postgres:";
    }),
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url(),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  SMTP_FROM: z.string().min(3),
  MFA_ENCRYPTION_KEY: encryptionKeySchema,
  RECOVERY_CODE_PEPPER: z.string().min(32),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function readServerEnv(input: Record<string, string | undefined>): ServerEnv {
  const parsed = serverEnvSchema.safeParse(input);
  if (parsed.success) return parsed.data;

  const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))].sort();
  throw new Error(`Invalid server environment: ${fields.join(", ")}`);
}

export function getServerEnv(): ServerEnv {
  return readServerEnv(process.env);
}

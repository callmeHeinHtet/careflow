import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .refine((value) => {
      const protocol = new URL(value).protocol;
      return protocol === "postgresql:" || protocol === "postgres:";
    }),
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

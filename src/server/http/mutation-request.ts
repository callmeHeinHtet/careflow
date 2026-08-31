import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import { AppError } from "./app-error";

const MAX_JSON_BYTES = 32 * 1024;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;

export function enforceSameOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    throw new AppError("INVALID_ORIGIN", "The request origin is not allowed", 403);
  }
}

export function parseIdempotencyKey(request: Request): string {
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key || !IDEMPOTENCY_KEY.test(key)) {
    throw new AppError(
      "IDEMPOTENCY_KEY_REQUIRED",
      "A valid Idempotency-Key header is required",
      400,
    );
  }
  return key;
}

export async function parseMutationJson<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!/^application\/json(?:\s*;|$)/.test(contentType)) {
    throw new AppError("UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json", 415);
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
    throw new AppError("PAYLOAD_TOO_LARGE", "The request body is too large", 413);
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) {
    throw new AppError("PAYLOAD_TOO_LARGE", "The request body is too large", 413);
  }

  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    throw new AppError("VALIDATION_FAILED", "The request body is not valid JSON", 400);
  }

  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError("VALIDATION_FAILED", "The request body is invalid", 400, {
      fields: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        code: issue.code,
        message: issue.message,
      })),
    });
  }
  return result.data;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function fingerprintPayload(payload: unknown): string {
  return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

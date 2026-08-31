import { randomUUID } from "node:crypto";

export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "MFA_ENROLLMENT_REQUIRED"
  | "MFA_REQUIRED"
  | "FORBIDDEN"
  | "VALIDATION_FAILED"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | "INVALID_ORIGIN"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "IDEMPOTENCY_CONFLICT"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INSUFFICIENT_STOCK"
  | "INTERNAL_ERROR";

const privateHeaders = { "Cache-Control": "no-store" };

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function appErrorResponse(error: unknown, correlationId = randomUUID()): Response {
  if (error instanceof AppError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
          correlationId,
        },
      },
      {
        status: error.status,
        headers: { ...privateHeaders, "X-Correlation-Id": correlationId },
      },
    );
  }

  console.error("CareFlow request failed", {
    correlationId,
    errorType: error instanceof Error ? error.name : "UnknownError",
  });
  return Response.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed",
        correlationId,
      },
    },
    {
      status: 500,
      headers: { ...privateHeaders, "X-Correlation-Id": correlationId },
    },
  );
}

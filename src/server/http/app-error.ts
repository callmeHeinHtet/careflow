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
  | "ALLERGY_CONFLICT"
  | "INSUFFICIENT_STOCK"
  | "RATE_LIMITED"
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
    const responseHeaders = new Headers({ ...privateHeaders, "X-Correlation-Id": correlationId });
    if (error.code === "RATE_LIMITED" && typeof error.details?.retryAfterSeconds === "number") {
      responseHeaders.set("Retry-After", String(error.details.retryAfterSeconds));
    }
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
        headers: responseHeaders,
      },
    );
  }

  console.error("CareFlow request failed", {
    correlationId,
    errorType: error instanceof Error ? error.name : "UnknownError",
    ...((error as { code?: unknown } | null)?.code && typeof (error as { code?: unknown }).code === "string" ? { errorCode: (error as { code: string }).code } : {}),
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

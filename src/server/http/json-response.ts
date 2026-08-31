import { randomUUID } from "node:crypto";

const privateHeaders = { "Cache-Control": "no-store" };

export function dataResponse<T>(data: T, init?: ResponseInit): Response {
  return Response.json(
    { data },
    { ...init, headers: { ...privateHeaders, ...init?.headers } },
  );
}

export function errorResponse(code: string, message: string, status: number): Response {
  return Response.json(
    { error: { code, message } },
    { status, headers: privateHeaders },
  );
}

export function internalErrorResponse(error: unknown): Response {
  const correlationId = randomUUID();
  console.error("CareFlow request failed", {
    correlationId,
    errorType: error instanceof Error ? error.name : "UnknownError",
  });

  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "The request could not be completed" } },
    {
      status: 500,
      headers: { ...privateHeaders, "X-Correlation-Id": correlationId },
    },
  );
}

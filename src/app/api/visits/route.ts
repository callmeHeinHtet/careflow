import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  AuthorizationError,
  authorizationErrorResponse,
  authorizeRequest,
} from "../../../server/auth/authorize";
import { Capability } from "../../../server/auth/permissions";
import { getDb } from "../../../server/db/client";
import { AppError, appErrorResponse } from "../../../server/http/app-error";
import { dataResponse } from "../../../server/http/json-response";
import { listVisits } from "../../../server/repositories/visit-repository";
import { visitQuerySchema } from "../../../server/validation/visit-mutations";

export function parseVisitQuery(params: URLSearchParams) {
  return visitQuerySchema.parse({
    stage: params.get("stage") || undefined,
    departmentId: params.get("departmentId") || undefined,
    query: params.get("query") || undefined,
    cursor: params.get("cursor") || undefined,
    limit: params.get("limit") || undefined,
  });
}

export async function GET(request: NextRequest): Promise<Response> {
  const correlationId = randomUUID();
  try {
    await authorizeRequest(request, Capability.PATIENT_READ);
    const input = parseVisitQuery(request.nextUrl.searchParams);
    return dataResponse(await listVisits(getDb(), input), {
      headers: { "X-Correlation-Id": correlationId },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) return authorizationErrorResponse(error);
    if (error instanceof z.ZodError) {
      return appErrorResponse(
        new AppError("VALIDATION_FAILED", "Invalid visit query", 400),
        correlationId,
      );
    }
    return appErrorResponse(error, correlationId);
  }
}

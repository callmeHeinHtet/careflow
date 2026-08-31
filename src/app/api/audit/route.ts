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
import { listAuditEvents } from "../../../server/repositories/audit-repository";
import { auditQuerySchema } from "../../../server/validation/audit-query";

function parseAuditQuery(params: URLSearchParams) {
  return auditQuerySchema.parse({
    action: params.get("action") || undefined,
    entityType: params.get("entityType") || undefined,
    entityId: params.get("entityId") || undefined,
    cursor: params.get("cursor") || undefined,
    limit: params.get("limit") || undefined,
  });
}

export async function GET(request: NextRequest): Promise<Response> {
  const correlationId = randomUUID();
  try {
    const session = await authorizeRequest(request, Capability.AUDIT_READ_LIMITED);
    const query = parseAuditQuery(request.nextUrl.searchParams);
    return dataResponse(
      await listAuditEvents(getDb(), {
        ...query,
        actorUserId: session.userId,
        role: session.role,
      }),
      { headers: { "X-Correlation-Id": correlationId } },
    );
  } catch (error) {
    if (error instanceof AuthorizationError) return authorizationErrorResponse(error);
    if (error instanceof z.ZodError) {
      return appErrorResponse(
        new AppError("VALIDATION_FAILED", "Invalid audit query", 400),
        correlationId,
      );
    }
    return appErrorResponse(error, correlationId);
  }
}

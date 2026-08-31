import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  AuthorizationError,
  authorizationErrorResponse,
  authorizeRequest,
} from "../../../../server/auth/authorize";
import { Capability } from "../../../../server/auth/permissions";
import { getDb } from "../../../../server/db/client";
import { AppError, appErrorResponse } from "../../../../server/http/app-error";
import { dataResponse } from "../../../../server/http/json-response";
import {
  enforceSameOrigin,
  parseIdempotencyKey,
  parseMutationJson,
} from "../../../../server/http/mutation-request";
import {
  mutationResponse,
  requestIpAddress,
} from "../../../../server/http/mutation-response";
import { getVisitById } from "../../../../server/repositories/visit-repository";
import { updateVisitPriority } from "../../../../server/services/visit-service";
import { visitPrioritySchema } from "../../../../server/validation/visit-mutations";

type VisitRouteContext = { params: Promise<{ id: string }> };
const idSchema = z.string().uuid();

export async function GET(request: NextRequest, context: VisitRouteContext): Promise<Response> {
  const correlationId = randomUUID();
  try {
    await authorizeRequest(request, Capability.PATIENT_READ);
    const id = idSchema.parse((await context.params).id);
    const visit = await getVisitById(getDb(), id);
    if (!visit) throw new AppError("NOT_FOUND", "Visit not found", 404);
    return dataResponse({ visit }, { headers: { "X-Correlation-Id": correlationId } });
  } catch (error) {
    if (error instanceof AuthorizationError) return authorizationErrorResponse(error);
    if (error instanceof z.ZodError) {
      return appErrorResponse(
        new AppError("VALIDATION_FAILED", "Invalid visit identifier", 400),
        correlationId,
      );
    }
    return appErrorResponse(error, correlationId);
  }
}

export async function PATCH(
  request: NextRequest,
  context: VisitRouteContext,
): Promise<Response> {
  const correlationId = randomUUID();
  try {
    const session = await authorizeRequest(request, Capability.QUEUE_PRIORITY_UPDATE);
    enforceSameOrigin(request);
    const id = idSchema.parse((await context.params).id);
    const input = await parseMutationJson(request, visitPrioritySchema);
    const result = await updateVisitPriority(
      getDb(),
      id,
      input,
      {
        userId: session.userId,
        displayName: session.displayName,
        role: session.role,
        correlationId,
        ipAddress: requestIpAddress(request),
      },
      parseIdempotencyKey(request),
    );
    return mutationResponse(result, correlationId);
  } catch (error) {
    if (error instanceof AuthorizationError) return authorizationErrorResponse(error);
    if (error instanceof z.ZodError) {
      return appErrorResponse(
        new AppError("VALIDATION_FAILED", "Invalid visit identifier", 400),
        correlationId,
      );
    }
    return appErrorResponse(error, correlationId);
  }
}

import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  AuthorizationError,
  authorizationErrorResponse,
  authorizeRequest,
} from "../../../../../server/auth/authorize";
import { Capability } from "../../../../../server/auth/permissions";
import { getDb } from "../../../../../server/db/client";
import { AppError, appErrorResponse } from "../../../../../server/http/app-error";
import {
  enforceSameOrigin,
  parseIdempotencyKey,
  parseMutationJson,
} from "../../../../../server/http/mutation-request";
import {
  mutationResponse,
  requestIpAddress,
} from "../../../../../server/http/mutation-response";
import { recordTriage } from "../../../../../server/services/visit-service";
import { triageSchema } from "../../../../../server/validation/visit-mutations";

type VisitRouteContext = { params: Promise<{ id: string }> };
const idSchema = z.string().uuid();

export async function POST(
  request: NextRequest,
  context: VisitRouteContext,
): Promise<Response> {
  const correlationId = randomUUID();
  try {
    const session = await authorizeRequest(request, Capability.TRIAGE_WRITE);
    enforceSameOrigin(request);
    const id = idSchema.parse((await context.params).id);
    const input = await parseMutationJson(request, triageSchema);
    const result = await recordTriage(
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

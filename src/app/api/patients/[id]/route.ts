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
import { appErrorResponse, AppError } from "../../../../server/http/app-error";
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
import { getPatientById } from "../../../../server/repositories/patient-repository";
import { updatePatientDemographics } from "../../../../server/services/patient-service";
import { patientUpdateSchema } from "../../../../server/validation/patient-mutations";

type PatientRouteContext = { params: Promise<{ id: string }> };
const idSchema = z.string().uuid();

export async function GET(request: NextRequest, context: PatientRouteContext): Promise<Response> {
  const correlationId = randomUUID();
  try {
    await authorizeRequest(request, Capability.PATIENT_READ);
    const id = idSchema.parse((await context.params).id);
    const patient = await getPatientById(getDb(), id);
    if (!patient) throw new AppError("NOT_FOUND", "Patient not found", 404);
    return dataResponse({ patient }, { headers: { "X-Correlation-Id": correlationId } });
  } catch (error) {
    if (error instanceof AuthorizationError) return authorizationErrorResponse(error);
    if (error instanceof z.ZodError) {
      return appErrorResponse(
        new AppError("VALIDATION_FAILED", "Invalid patient identifier", 400),
        correlationId,
      );
    }
    return appErrorResponse(error, correlationId);
  }
}

export async function PATCH(
  request: NextRequest,
  context: PatientRouteContext,
): Promise<Response> {
  const correlationId = randomUUID();
  try {
    const session = await authorizeRequest(request, Capability.PATIENT_DEMOGRAPHICS_UPDATE);
    enforceSameOrigin(request);
    const id = idSchema.parse((await context.params).id);
    const idempotencyKey = parseIdempotencyKey(request);
    const input = await parseMutationJson(request, patientUpdateSchema);
    const result = await updatePatientDemographics(
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
      idempotencyKey,
    );
    return mutationResponse(result, correlationId);
  } catch (error) {
    if (error instanceof AuthorizationError) return authorizationErrorResponse(error);
    if (error instanceof z.ZodError) {
      return appErrorResponse(
        new AppError("VALIDATION_FAILED", "Invalid patient identifier", 400),
        correlationId,
      );
    }
    return appErrorResponse(error, correlationId);
  }
}

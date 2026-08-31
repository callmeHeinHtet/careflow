import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  AuthorizationError,
  authorizationErrorResponse,
  authorizeRequest,
} from "../../../server/auth/authorize";
import { Capability } from "../../../server/auth/permissions";
import { getDb } from "../../../server/db/client";
import {
  dataResponse,
  errorResponse,
  internalErrorResponse,
} from "../../../server/http/json-response";
import { appErrorResponse } from "../../../server/http/app-error";
import {
  enforceSameOrigin,
  parseIdempotencyKey,
  parseMutationJson,
} from "../../../server/http/mutation-request";
import { mutationResponse, requestIpAddress } from "../../../server/http/mutation-response";
import { listPatients } from "../../../server/repositories/patient-repository";
import { registerPatient } from "../../../server/services/patient-service";
import { patientRegistrationSchema } from "../../../server/validation/patient-mutations";

const patientQuerySchema = z.object({
  query: z.string().trim().max(100).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).transform((value) => Math.min(25, value)).default(25),
});

export function parsePatientQuery(params: URLSearchParams) {
  return patientQuerySchema.parse({
    query: params.get("query") || undefined,
    cursor: params.get("cursor") || undefined,
    limit: params.get("limit") || undefined,
  });
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    await authorizeRequest(request, Capability.PATIENT_READ);
    const input = parsePatientQuery(new URL(request.url).searchParams);
    return dataResponse(await listPatients(getDb(), input));
  } catch (error) {
    if (error instanceof AuthorizationError) return authorizationErrorResponse(error);
    if (error instanceof z.ZodError) {
      return errorResponse("VALIDATION_FAILED", "Invalid patient query", 400);
    }
    return internalErrorResponse(error);
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const correlationId = randomUUID();
  try {
    const session = await authorizeRequest(request, Capability.PATIENT_REGISTER);
    enforceSameOrigin(request);
    const idempotencyKey = parseIdempotencyKey(request);
    const input = await parseMutationJson(request, patientRegistrationSchema);
    const result = await registerPatient(
      getDb(),
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
    return appErrorResponse(error, correlationId);
  }
}

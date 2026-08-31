import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import {
  AuthorizationError,
  authorizationErrorResponse,
  authorizeRequest,
} from "../../../server/auth/authorize";
import { Capability } from "../../../server/auth/permissions";
import { getDb } from "../../../server/db/client";
import { appErrorResponse } from "../../../server/http/app-error";
import { dataResponse } from "../../../server/http/json-response";
import { getConsultationCatalog } from "../../../server/repositories/consultation-catalog-repository";

export async function GET(request: NextRequest): Promise<Response> {
  const correlationId = randomUUID();
  try {
    await authorizeRequest(request, Capability.CONSULTATION_READ);
    return dataResponse(await getConsultationCatalog(getDb()), {
      headers: { "X-Correlation-Id": correlationId },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) return authorizationErrorResponse(error);
    return appErrorResponse(error, correlationId);
  }
}

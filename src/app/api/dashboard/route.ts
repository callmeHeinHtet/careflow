import type { NextRequest } from "next/server";
import {
  AuthorizationError,
  authorizationErrorResponse,
  authorizeRequest,
} from "../../../server/auth/authorize";
import { Capability } from "../../../server/auth/permissions";
import { getDb } from "../../../server/db/client";
import { internalErrorResponse, dataResponse } from "../../../server/http/json-response";
import { getDashboardSnapshot } from "../../../server/repositories/dashboard-repository";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    await authorizeRequest(request, Capability.DASHBOARD_READ);
    return dataResponse(await getDashboardSnapshot(getDb(), new Date()));
  } catch (error) {
    if (error instanceof AuthorizationError) return authorizationErrorResponse(error);
    return internalErrorResponse(error);
  }
}

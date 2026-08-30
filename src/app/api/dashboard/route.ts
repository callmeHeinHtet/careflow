import { getDb } from "../../../server/db/client";
import { internalErrorResponse, dataResponse } from "../../../server/http/json-response";
import { getDashboardSnapshot } from "../../../server/repositories/dashboard-repository";

export async function GET(): Promise<Response> {
  try {
    return dataResponse(await getDashboardSnapshot(getDb(), new Date()));
  } catch (error) {
    return internalErrorResponse(error);
  }
}

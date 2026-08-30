import { z } from "zod";
import { getDb } from "../../../server/db/client";
import {
  dataResponse,
  errorResponse,
  internalErrorResponse,
} from "../../../server/http/json-response";
import { listPatients } from "../../../server/repositories/patient-repository";

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

export async function GET(request: Request): Promise<Response> {
  try {
    const input = parsePatientQuery(new URL(request.url).searchParams);
    return dataResponse(await listPatients(getDb(), input));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse("VALIDATION_FAILED", "Invalid patient query", 400);
    }
    return internalErrorResponse(error);
  }
}

type PersistedResponse = {
  status: number;
  body: unknown;
  replayed: boolean;
};

export function mutationResponse(result: PersistedResponse, correlationId: string): Response {
  return Response.json(result.body, {
    status: result.status,
    headers: {
      "Cache-Control": "no-store",
      "X-Correlation-Id": correlationId,
      "Idempotency-Replayed": String(result.replayed),
    },
  });
}

export function requestIpAddress(request: Request): string | null {
  return request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() || null;
}

import { describe, expect, it } from "vitest";
import { AppError, appErrorResponse } from "../../src/server/http/app-error";
import { rateLimitKey } from "../../src/server/security/rate-limit";

describe("shared request throttling", () => {
  it("hashes raw identifiers before they are stored as rate-limit keys", () => {
    const key = rateLimitKey("sign-in", "staff@example.test");
    expect(key).toMatch(/^sign-in:[a-f0-9]{64}$/);
    expect(key).not.toContain("staff@example.test");
  });

  it("keeps route-scoped keys within the database key limit", () => {
    const key = rateLimitKey("mutation:/api/visits/7bfad77b-fc5c-4c14-8985-e0de547ab77e/consultation", "user:203.0.113.9");
    expect(key.length).toBeLessThanOrEqual(100);
  });

  it("returns a retry-after header for throttled requests", async () => {
    const response = appErrorResponse(new AppError("RATE_LIMITED", "Try again later", 429, { retryAfterSeconds: 45 }), "a6b104ad-cfaa-468e-b73a-774d458f06af");
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("45");
  });
});

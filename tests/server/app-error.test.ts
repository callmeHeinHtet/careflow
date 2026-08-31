import { describe, expect, it, vi } from "vitest";
import { AppError, appErrorResponse } from "../../src/server/http/app-error";

describe("application errors", () => {
  it("returns safe stable errors with a correlation identifier", async () => {
    const response = appErrorResponse(
      new AppError("CONFLICT", "The record changed", 409, { currentVersion: 3 }),
      "4fe36ce0-ccaa-4f63-a135-bba4f3595548",
    );

    expect(response.status).toBe(409);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-correlation-id")).toBe("4fe36ce0-ccaa-4f63-a135-bba4f3595548");
    expect(await response.json()).toEqual({
      error: {
        code: "CONFLICT",
        message: "The record changed",
        details: { currentVersion: 3 },
        correlationId: "4fe36ce0-ccaa-4f63-a135-bba4f3595548",
      },
    });
  });

  it("sanitizes unexpected errors without logging their message", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = appErrorResponse(
      new Error("postgresql://user:secret@database/private"),
      "213741a5-8a2b-4559-a7f0-0605760fd638",
    );

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
    expect(spy).toHaveBeenCalledWith("CareFlow request failed", {
      correlationId: "213741a5-8a2b-4559-a7f0-0605760fd638",
      errorType: "Error",
    });
    spy.mockRestore();
  });
});

import { afterAll, describe, expect, it } from "vitest";
import { GET } from "../../src/app/api/health/route";
import { disconnectDb } from "../../src/server/db/client";

afterAll(async () => disconnectDb());

describe("GET /api/health", () => {
  it("reports a reachable PostgreSQL dependency without leaking configuration", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok", database: "reachable" });
  });
});

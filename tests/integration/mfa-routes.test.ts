import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST as beginEnrollment } from "../../src/app/api/auth/mfa/setup/route";

describe("MFA route boundary", () => {
  it("rejects cross-origin enrollment before reading a session", async () => {
    const response = await beginEnrollment(
      new NextRequest("http://localhost:3000/api/auth/mfa/setup", {
        method: "POST",
        headers: { origin: "https://evil.test" },
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  it("rejects a same-origin request without a database session", async () => {
    const response = await beginEnrollment(
      new NextRequest("http://localhost:3000/api/auth/mfa/setup", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

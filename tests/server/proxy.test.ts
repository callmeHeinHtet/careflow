import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "../../src/proxy";

describe("optimistic page proxy", () => {
  it("redirects a page request without a session cookie to sign in", () => {
    const response = proxy(new NextRequest("https://careflow.test/patients"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://careflow.test/sign-in?callbackUrl=%2Fpatients",
    );
  });

  it("allows a page request with a session cookie for secure page-level validation", () => {
    const response = proxy(
      new NextRequest("https://careflow.test/", {
        headers: { cookie: "authjs.session-token=opaque-session-token" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});

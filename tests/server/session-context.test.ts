import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { isSameOriginRequest, readSessionToken } from "../../src/server/auth/session-context";

describe("session request context", () => {
  it("reads normal, secure, and chunked Auth.js database-session cookies", () => {
    const normal = new NextRequest("https://careflow.test", {
      headers: { cookie: "authjs.session-token=normal-session-token" },
    });
    const secure = new NextRequest("https://careflow.test", {
      headers: { cookie: "__Secure-authjs.session-token=secure-session-token" },
    });
    const chunked = new NextRequest("https://careflow.test", {
      headers: {
        cookie: "authjs.session-token.1=session-token; authjs.session-token.0=chunked-",
      },
    });

    expect(readSessionToken(normal)).toBe("normal-session-token");
    expect(readSessionToken(secure)).toBe("secure-session-token");
    expect(readSessionToken(chunked)).toBe("chunked-session-token");
  });

  it("rejects missing, short, and cross-origin requests", () => {
    const short = new NextRequest("https://careflow.test", {
      headers: { cookie: "authjs.session-token=short", origin: "https://evil.test" },
    });

    expect(readSessionToken(short)).toBeNull();
    expect(isSameOriginRequest(short)).toBe(false);
    expect(isSameOriginRequest(new NextRequest("https://careflow.test"))).toBe(false);
    expect(
      isSameOriginRequest(
        new NextRequest("https://careflow.test/api/auth/mfa/verify", {
          headers: { origin: "https://careflow.test" },
        }),
      ),
    ).toBe(true);
  });
});

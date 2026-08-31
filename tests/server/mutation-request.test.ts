import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  enforceSameOrigin,
  fingerprintPayload,
  parseIdempotencyKey,
  parseMutationJson,
} from "../../src/server/http/mutation-request";
import { AppError } from "../../src/server/http/app-error";

const bodySchema = z.object({ name: z.string().min(1) }).strict();

function request(body: string, headers: Record<string, string> = {}) {
  return new NextRequest("https://careflow.test/api/patients", {
    method: "POST",
    body,
    headers,
  });
}

describe("mutation request boundary", () => {
  it("accepts strict JSON and rejects unknown properties", async () => {
    const valid = request(JSON.stringify({ name: "May" }), {
      "content-type": "application/json; charset=utf-8",
    });
    await expect(parseMutationJson(valid, bodySchema)).resolves.toEqual({ name: "May" });

    const invalid = request(JSON.stringify({ name: "May", role: "ADMIN" }), {
      "content-type": "application/json",
    });
    await expect(parseMutationJson(invalid, bodySchema)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      status: 400,
    });
  });

  it("rejects unsupported media types, oversized bodies, and malformed JSON", async () => {
    await expect(parseMutationJson(request("{}"), bodySchema)).rejects.toMatchObject({
      code: "UNSUPPORTED_MEDIA_TYPE",
      status: 415,
    });

    const oversized = request(JSON.stringify({ name: "x".repeat(33_000) }), {
      "content-type": "application/json",
    });
    await expect(parseMutationJson(oversized, bodySchema)).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
      status: 413,
    });

    const malformed = request("{", { "content-type": "application/json" });
    await expect(parseMutationJson(malformed, bodySchema)).rejects.toBeInstanceOf(AppError);
  });

  it("requires exact same-origin mutations", () => {
    const valid = request("{}", { origin: "https://careflow.test" });
    expect(() => enforceSameOrigin(valid)).not.toThrow();

    const invalid = request("{}", { origin: "https://evil.test" });
    expect(() => enforceSameOrigin(invalid)).toThrowError(
      expect.objectContaining({ code: "INVALID_ORIGIN", status: 403 }),
    );
  });

  it("validates idempotency keys and fingerprints equivalent payloads consistently", () => {
    const valid = request("{}", { "idempotency-key": "register_01J7Z8M4D73B6F2K9P0Q" });
    expect(parseIdempotencyKey(valid)).toBe("register_01J7Z8M4D73B6F2K9P0Q");
    expect(fingerprintPayload({ b: 2, a: { y: 2, x: 1 } })).toBe(
      fingerprintPayload({ a: { x: 1, y: 2 }, b: 2 }),
    );

    expect(() => parseIdempotencyKey(request("{}"))).toThrowError(
      expect.objectContaining({ code: "IDEMPOTENCY_KEY_REQUIRED", status: 400 }),
    );
  });
});

import { expect, test } from "@playwright/test";

test("production server reports its PostgreSQL dependency ready", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(await response.json()).toEqual({ status: "ok", database: "reachable" });
});

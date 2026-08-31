import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mutationRoutes = [
  "src/app/api/patients/route.ts",
  "src/app/api/patients/[id]/route.ts",
  "src/app/api/visits/[id]/route.ts",
  "src/app/api/visits/[id]/triage/route.ts",
  "src/app/api/visits/[id]/consultation/route.ts",
  "src/app/api/visits/[id]/dispense/route.ts",
  "src/app/api/visits/[id]/payment/route.ts",
];

describe("mutation throttling boundary", () => {
  it.each(mutationRoutes)("enforces a shared rate limit in %s", (path) => {
    expect(readFileSync(path, "utf8")).toContain("enforceMutationRateLimit");
  });
});

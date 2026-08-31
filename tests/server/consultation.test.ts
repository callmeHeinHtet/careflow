import { describe, expect, it } from "vitest";
import { consultationSchema } from "../../src/server/validation/consultation";

const input = {
  version: 2,
  findings: "Patient examined; findings recorded by clinician.",
  diagnosis: "Clinician-entered assessment",
  followUp: "Review in seven days",
  labServiceIds: ["a0000000-0000-4000-8000-000000000002"],
  prescriptions: [
    {
      medicationId: "40000000-0000-4000-8000-000000000001",
      quantity: 4,
      directions: "One tablet as directed",
    },
  ],
};

describe("consultation validation", () => {
  it("accepts strict clinician-entered findings and orders", () => {
    expect(consultationSchema.parse(input)).toEqual(input);
  });

  it("rejects duplicate orders, invalid quantities, and unexpected properties", () => {
    expect(() =>
      consultationSchema.parse({
        ...input,
        prescriptions: [input.prescriptions[0], input.prescriptions[0]],
      }),
    ).toThrow();
    expect(() =>
      consultationSchema.parse({
        ...input,
        prescriptions: [{ ...input.prescriptions[0], quantity: 0 }],
      }),
    ).toThrow();
    expect(() => consultationSchema.parse({ ...input, total: 1 })).toThrow();
  });
});

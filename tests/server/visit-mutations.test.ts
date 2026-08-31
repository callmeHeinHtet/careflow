import { describe, expect, it } from "vitest";
import {
  triageSchema,
  visitPrioritySchema,
  visitQuerySchema,
} from "../../src/server/validation/visit-mutations";

describe("visit validation", () => {
  it("bounds filters and pagination", () => {
    expect(visitQuerySchema.parse({ limit: "1000", stage: "WAITING" })).toEqual({
      limit: 25,
      stage: "WAITING",
    });
    expect(() => visitQuerySchema.parse({ stage: "UNKNOWN" })).toThrow();
  });

  it("accepts strict priority updates", () => {
    expect(visitPrioritySchema.parse({ version: 1, priority: "URGENT" })).toEqual({
      version: 1,
      priority: "URGENT",
    });
    expect(() => visitPrioritySchema.parse({ version: 1, priority: "URGENT", stage: "DISCHARGED" })).toThrow();
  });

  it("validates clinical ranges without interpreting them", () => {
    const input = {
      version: 1,
      temperature: 37.2,
      bloodPressure: "120/80",
      heartRate: 82,
      oxygenSat: 98,
      symptoms: "Persistent cough",
      notes: "Patient-reported symptoms recorded.",
      priority: "SOON",
    };
    expect(triageSchema.parse(input)).toEqual(input);
    expect(() => triageSchema.parse({ ...input, oxygenSat: 101 })).toThrow();
  });
});

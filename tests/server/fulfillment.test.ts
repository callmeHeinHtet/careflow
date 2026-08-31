import { describe, expect, it } from "vitest";
import { dispenseSchema, paymentSchema } from "../../src/server/validation/fulfillment";

describe("fulfillment validation", () => {
  it("accepts only a visit version and prescription identifier for dispensing", () => {
    const input = {
      version: 2,
      prescriptionId: "61000000-0000-4000-8000-000000000001",
    };
    expect(dispenseSchema.parse(input)).toEqual(input);
    expect(() => dispenseSchema.parse({ ...input, quantity: 1 })).toThrow();
  });

  it("accepts payment method and versions without a client-submitted amount", () => {
    const input = { visitVersion: 1, invoiceVersion: 1, method: "CASH", reference: "RECEIPT-001" };
    expect(paymentSchema.parse(input)).toEqual(input);
    expect(() => paymentSchema.parse({ ...input, amount: 1 })).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import {
  patientRegistrationSchema,
  patientUpdateSchema,
} from "../../src/server/validation/patient-mutations";

const registration = {
  firstName: "  Mya  ",
  lastName: "Win",
  dateOfBirth: "1994-05-17",
  sex: "F",
  phone: "+95 9 420 555 123",
  address: "Yangon",
  allergies: [{ substance: "Penicillin", notes: "Rash" }],
  departmentId: "10000000-0000-4000-8000-000000000001",
  symptoms: "Persistent fever",
  priority: "SOON",
};

describe("patient mutation validation", () => {
  it("normalizes a valid registration payload", () => {
    expect(patientRegistrationSchema.parse(registration)).toMatchObject({
      firstName: "Mya",
      priority: "SOON",
    });
  });

  it("rejects future birth dates, duplicate allergies, and unknown properties", () => {
    expect(() =>
      patientRegistrationSchema.parse({
        ...registration,
        dateOfBirth: "2999-01-01",
        allergies: [{ substance: "Penicillin" }, { substance: "penicillin" }],
      }),
    ).toThrow();
    expect(() => patientRegistrationSchema.parse({ ...registration, role: "ADMIN" })).toThrow();
  });

  it("requires a version and at least one demographic change", () => {
    expect(patientUpdateSchema.parse({ version: 2, phone: "09 123 456 789" })).toEqual({
      version: 2,
      phone: "09 123 456 789",
    });
    expect(() => patientUpdateSchema.parse({ version: 2 })).toThrow();
  });
});

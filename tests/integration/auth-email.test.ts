import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountStatus, StaffRole } from "../../src/generated/prisma/client";
import { sendCareFlowSignInEmail } from "../../src/server/auth/email";
import { createTestDb, resetTestDb } from "../../src/server/db/reset-test-db";

const db = createTestDb();

beforeEach(async () => resetTestDb(db));
afterAll(async () => db.$disconnect());

describe("CareFlow sign-in email delivery", () => {
  it("silently sends nothing to an unknown address", async () => {
    const sendMail = vi.fn();

    await sendCareFlowSignInEmail(db, { sendMail }, {
      identifier: "unknown@careflow.test",
      url: "https://careflow.test/api/auth/callback/nodemailer?token=secret",
      from: "CareFlow <no-reply@careflow.test>",
    });

    expect(sendMail).not.toHaveBeenCalled();
  });

  it("sends a fixed-shape message to eligible staff without raw content", async () => {
    await db.user.create({
      data: {
        email: "admin@careflow.test",
        status: AccountStatus.INVITED,
        staffProfile: {
          create: {
            employeeNumber: "CF-ADM-001",
            displayName: "CareFlow Admin",
            role: StaffRole.ADMIN,
          },
        },
      },
    });
    const sendMail = vi.fn().mockResolvedValue({ rejected: [], pending: [] });

    await sendCareFlowSignInEmail(db, { sendMail }, {
      identifier: "admin@careflow.test",
      url: "https://careflow.test/api/auth/callback/nodemailer?token=secret",
      from: "CareFlow <no-reply@careflow.test>",
    });

    expect(sendMail).toHaveBeenCalledOnce();
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@careflow.test",
        subject: "Your CareFlow sign-in link",
        text: expect.stringContaining("token=secret"),
      }),
    );
    expect(sendMail.mock.calls[0][0]).not.toHaveProperty("raw");
    expect(sendMail.mock.calls[0][0]).not.toHaveProperty("html");
  });
});

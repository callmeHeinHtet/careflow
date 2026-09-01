import { expect, request, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";

const mailpitUrl = process.env.MAILPIT_URL ?? "http://127.0.0.1:8025";

type MailpitMessage = {
  ID: string;
  Subject: string;
  To: Array<{ Address: string }>;
};

async function waitForSignInLink(recipient: string): Promise<string> {
  const mailpit = await request.newContext({ baseURL: mailpitUrl });
  try {
    await expect.poll(async () => {
      const response = await mailpit.get("/api/v1/messages");
      if (!response.ok()) return null;
      const body = await response.json() as { messages: MailpitMessage[] };
      return body.messages.find((message) =>
        message.Subject === "Your CareFlow sign-in link" &&
        message.To.some((address) => address.Address === recipient),
      )?.ID ?? null;
    }, { timeout: 10_000 }).not.toBeNull();

    const list = await mailpit.get("/api/v1/messages");
    const body = await list.json() as { messages: MailpitMessage[] };
    const message = body.messages.find((item) =>
      item.Subject === "Your CareFlow sign-in link" &&
      item.To.some((address) => address.Address === recipient),
    );
    if (!message) throw new Error(`No CareFlow sign-in email found for ${recipient}`);

    const detail = await mailpit.get(`/api/v1/message/${message.ID}`);
    if (!detail.ok()) throw new Error(`Mailpit message lookup failed with ${detail.status()}`);
    const content = await detail.json() as { Text: string };
    const link = content.Text.match(/https?:\/\/\S+/)?.[0];
    if (!link) throw new Error("CareFlow sign-in link was missing from the email");
    return link;
  } finally {
    await mailpit.dispose();
  }
}

async function enrollAndEnter(page: Page, email: string, displayName: string, role: string) {
  await page.getByLabel("Work email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText("Check your inbox");

  await page.goto(await waitForSignInLink(email));
  await expect(page).toHaveURL(/\/enroll-mfa$/);
  await page.getByRole("button", { name: "Start secure setup" }).click();

  const secret = (await page.locator(".secret-key code").textContent())?.trim();
  expect(secret).toBeTruthy();
  const totp = new OTPAuth.TOTP({
    issuer: "CareFlow",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });

  await page.getByLabel("Verification code").fill(totp.generate());
  await page.getByRole("button", { name: "Verify and finish" }).click();
  await expect(page.getByLabel("Recovery codes").locator("code")).toHaveCount(8);
  await page.getByRole("button", { name: "Enter CareFlow" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();
  const identity = page.locator(".staff-identity");
  await expect(identity.getByText(displayName, { exact: true })).toBeVisible();
  await expect(identity.getByText(role, { exact: true })).toBeVisible();
}

async function signOut(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in(?:\?|$)/);
}

async function fillTriage(page: Page) {
  await page.getByLabel("Temperature (°C)").fill("37.1");
  await page.getByLabel("Blood pressure").fill("118/76");
  await page.getByLabel("Heart rate (bpm)").fill("78");
  await page.getByLabel("SpO2 (%)").fill("99");
  await page.getByLabel("Nursing notes").fill("Release journey observations");
}

test("invited staff complete secure authentication and the multi-role patient journey", async ({ page }) => {
  test.setTimeout(120_000);
  const patientName = "E2E Patient";

  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in(?:\?|$)/);
  await enrollAndEnter(page, "reception@careflow.test", "Aye Aye", "Reception");

  await page.getByRole("button", { name: "Patients", exact: true }).click();
  await page.getByRole("button", { name: "Add patient" }).click();
  await page.getByLabel("First name").fill("E2E");
  await page.getByLabel("Last name").fill("Patient");
  await page.getByLabel("Date of birth").fill("1990-01-15");
  await page.getByLabel("Phone").fill("09 555 010 020");
  await page.getByLabel("Address").fill("42 Browser Test Lane");
  await page.getByLabel("Reason for visit").fill("Release journey verification");
  await page.getByLabel("Initial priority").selectOption("urgent");
  await page.getByRole("button", { name: "Register patient" }).click();
  await expect(page.getByRole("status")).toContainText("E2E Patient registered");

  const search = page.getByPlaceholder("Search patients, queue or department");
  await search.fill(patientName);
  const patient = page.getByRole("button", { name: new RegExp(patientName) });
  await expect(patient).toBeVisible();
  await patient.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "E2E Patient" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "E2E Patient" })).toBeHidden();

  const structure = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")];
    const controls = [...document.querySelectorAll("input, select, textarea")];
    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
    return {
      unnamedButtons: buttons.filter((button) =>
        !button.textContent?.trim() &&
        !button.getAttribute("aria-label") &&
        !button.getAttribute("title"),
      ).length,
      unlabeledControls: controls.filter((control) => {
        const id = control.getAttribute("id");
        return !control.getAttribute("aria-label") &&
          !(id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) &&
          !control.closest("label");
      }).length,
      duplicateIds: ids.length - new Set(ids).size,
      missingImageAlts: [...document.querySelectorAll("img")].filter((image) => !image.hasAttribute("alt")).length,
    };
  });
  expect(structure).toEqual({
    unnamedButtons: 0,
    unlabeledControls: 0,
    duplicateIds: 0,
    missingImageAlts: 0,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("navigation", { name: "Workspaces" })).toBeVisible();
  await page.getByRole("button", { name: /Patient Queue/ }).click();
  await expect(page.getByRole("heading", { name: "Patient Queue" })).toBeVisible();

  await signOut(page);

  await enrollAndEnter(page, "nurse@careflow.test", "Maya Win", "Nurse");
  await page.getByRole("button", { name: /Patient Queue/ }).click();
  let row = page.locator(".queue-table-row").filter({ hasText: patientName });
  await row.getByRole("button", { name: "Send to triage" }).click();
  await fillTriage(page);

  await page.evaluate(async (name) => {
    const workspaceResponse = await fetch("/api/workspace", { cache: "no-store" });
    const workspace = await workspaceResponse.json();
    const target = workspace.data.patients.find((candidate: { name: string }) => candidate.name === name);
    const response = await fetch(`/api/visits/${target.visitId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({ version: target.visitVersion, priority: "CRITICAL" }),
    });
    if (!response.ok) throw new Error(`Concurrent priority update failed with ${response.status}`);
  }, patientName);

  await page.getByRole("button", { name: "Save triage" }).click();
  await expect(page.getByRole("status")).toContainText("The visit changed");
  await page.reload();
  await page.getByRole("button", { name: /Patient Queue/ }).click();
  row = page.locator(".queue-table-row").filter({ hasText: patientName });
  await row.getByRole("button", { name: "Send to triage" }).click();
  await fillTriage(page);
  await page.getByRole("button", { name: "Save triage" }).click();
  await expect(page.getByRole("status")).toContainText(`${patientName} advanced to consultation`);
  await signOut(page);

  await enrollAndEnter(page, "doctor@careflow.test", "Dr. Aye Min", "Doctor");
  await page.getByRole("button", { name: "Consultations" }).click();
  await expect(page.getByRole("heading", { name: "Consultation", exact: true })).toBeVisible();
  await page.getByRole("button", { name: new RegExp(patientName) }).click();
  await page.getByRole("button", { name: "Start consultation" }).click();
  await page.getByLabel("Findings").fill("Stable fictional presentation");
  await page.getByLabel("Diagnosis").fill("Fictional release-check diagnosis");
  await page.getByRole("dialog", { name: "Complete consultation" }).locator('.check-options input[type="checkbox"]').first().check();
  await page.getByRole("button", { name: "Complete consultation" }).click();
  await expect(page.getByRole("status")).toContainText(`${patientName} consultation completed`);
  await signOut(page);

  await enrollAndEnter(page, "pharmacy@careflow.test", "Thiri Moe", "Pharmacy");
  await page.getByRole("button", { name: "Inventory" }).click();
  const prescription = page.locator(".prescription").filter({ hasText: patientName });
  await prescription.getByRole("button", { name: "Dispense" }).click();
  await expect(page.getByRole("status")).toContainText("Prescription dispensed");
  await signOut(page);

  await enrollAndEnter(page, "cashier@careflow.test", "Min Thu", "Cashier");
  await page.getByRole("button", { name: "Billing", exact: true }).click();
  const invoice = page.locator(".invoice").filter({ hasText: patientName });
  await invoice.getByRole("button", { name: "Mark paid" }).click();
  await expect(page.getByRole("status")).toContainText(`${patientName} paid and discharged`);
  await page.getByPlaceholder("Search patients, queue or department").fill(patientName);
  await page.getByRole("button", { name: "Patients", exact: true }).click();
  await expect(page.locator(".patient-row").filter({ hasText: patientName })).toContainText("discharged");
  await signOut(page);

  await enrollAndEnter(page, "admin@careflow.test", "CareFlow Admin", "Admin");
  await page.getByRole("button", { name: "Daily Summary" }).click();
  await expect(page.getByRole("heading", { name: "Daily Summary" })).toBeVisible();
  await expect(page.getByText("INVOICE_SETTLED", { exact: true })).toBeVisible();
  await signOut(page);
});

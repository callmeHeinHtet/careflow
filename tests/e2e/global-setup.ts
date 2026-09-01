import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const mailpitUrl = process.env.MAILPIT_URL ?? "http://127.0.0.1:8025";

async function clearMailpit() {
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      const response = await fetch(`${mailpitUrl}/api/v1/messages`, { method: "DELETE" });
      if (response.ok) return;
    } catch {
      // The CI service container may still be starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }

  throw new Error("Mailpit did not become ready within 10 seconds");
}

export default async function globalSetup() {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
  if (databaseUrl.pathname.replace(/^\//, "") !== "careflow_test") {
    throw new Error("Playwright refuses to reset any database except careflow_test");
  }

  await clearMailpit();

  const tsx = resolve("node_modules", "tsx", "dist", "cli.mjs");
  execFileSync(process.execPath, [tsx, "tests/e2e/reset-test-state.ts"], {
    env: process.env,
    stdio: "inherit",
  });
  execFileSync(process.execPath, [tsx, "prisma/seed.ts"], {
    env: process.env,
    stdio: "inherit",
  });
}

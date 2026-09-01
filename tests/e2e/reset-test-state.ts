import { createTestDb, resetTestDb } from "../../src/server/db/reset-test-db";

async function main() {
  const db = createTestDb();

  try {
    await resetTestDb(db);
  } finally {
    await db.$disconnect();
  }
}

void main();

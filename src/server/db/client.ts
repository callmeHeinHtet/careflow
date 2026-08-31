import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { getServerEnv } from "../env";

const globalForDb = globalThis as typeof globalThis & {
  careflowDb?: PrismaClient;
};

export function getDb(): PrismaClient {
  if (globalForDb.careflowDb) return globalForDb.careflowDb;

  const adapter = new PrismaPg({ connectionString: getServerEnv().DATABASE_URL });
  const client = new PrismaClient({ adapter });
  globalForDb.careflowDb = client;
  return client;
}

export async function disconnectDb(): Promise<void> {
  if (!globalForDb.careflowDb) return;
  await globalForDb.careflowDb.$disconnect();
  delete globalForDb.careflowDb;
}

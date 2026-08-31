import { getDb } from "../../../server/db/client";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET(): Promise<Response> {
  try {
    await getDb().$queryRaw`SELECT 1`;
    return Response.json(
      { status: "ok", database: "reachable" },
      { status: 200, headers: noStoreHeaders },
    );
  } catch {
    return Response.json(
      { status: "degraded", database: "unreachable" },
      { status: 503, headers: noStoreHeaders },
    );
  }
}

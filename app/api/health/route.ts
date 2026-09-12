import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return Response.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return Response.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}

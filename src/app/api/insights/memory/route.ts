import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const memories = await sql`
      SELECT id, type, content, created_at::text AS created_at
      FROM ai_memory WHERE user_id = ${userId}
      ORDER BY created_at DESC LIMIT 50`;

    return NextResponse.json({ memories, count: memories.length });
  } catch {
    return NextResponse.json({ memories: [], count: 0 });
  }
}

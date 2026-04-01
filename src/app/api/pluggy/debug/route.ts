import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import sql from "@/lib/db";

const PLUGGY_BASE_URL = "https://api.pluggy.ai";

// Endpoint de diagnóstico — testa cada etapa separadamente
export async function GET(request: Request) {
  const checks: Record<string, unknown> = {};

  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    // 1. Variáveis de ambiente
    checks.env = {
      PLUGGY_CLIENT_ID: process.env.PLUGGY_CLIENT_ID ? `${process.env.PLUGGY_CLIENT_ID.substring(0, 8)}...` : "MISSING",
      PLUGGY_CLIENT_SECRET: process.env.PLUGGY_CLIENT_SECRET ? "SET" : "MISSING",
      DATABASE_URL: process.env.DATABASE_URL ? `${process.env.DATABASE_URL.substring(0, 30)}...` : "MISSING",
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "MISSING",
    };

    // 2. Pluggy auth
    try {
      const authRes = await fetch(`${PLUGGY_BASE_URL}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: process.env.PLUGGY_CLIENT_ID,
          clientSecret: process.env.PLUGGY_CLIENT_SECRET,
          nonExpiring: false,
        }),
      });
      const authBody = await authRes.text();
      checks.pluggyAuth = authRes.ok
        ? { status: "OK", hasApiKey: !!JSON.parse(authBody).apiKey }
        : { status: "FAILED", httpStatus: authRes.status, body: authBody.substring(0, 300) };
    } catch (e) {
      checks.pluggyAuth = { status: "ERROR", message: e instanceof Error ? e.message : String(e) };
    }

    // 3. PostgreSQL direto — testar conexão e cada tabela
    const tables = ["pluggy_items", "accounts", "transactions", "credit_cards", "investments", "loans", "insights_cache", "credit_score"];
    const tableChecks: Record<string, unknown> = {};

    for (const table of tables) {
      try {
        const result = await sql.unsafe(`SELECT count(*) as total FROM ${table}`);
        tableChecks[table] = { status: "OK", count: Number(result[0].total) };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        tableChecks[table] = { status: "ERROR", message: msg.substring(0, 200) };
      }
    }

    checks.database = { status: "OK", method: "postgres (direct TCP)", tables: tableChecks };

    return NextResponse.json({ checks });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
      checks,
    }, { status: 500 });
  }
}

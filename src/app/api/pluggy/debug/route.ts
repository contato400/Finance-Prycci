import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseSelect } from "@/lib/supabase/rest";

const PLUGGY_BASE_URL = "https://api.pluggy.ai";

// Endpoint de diagnóstico — testa cada etapa separadamente
export async function GET() {
  const checks: Record<string, unknown> = {};

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // 1. Verificar variáveis de ambiente
    checks.env = {
      PLUGGY_CLIENT_ID: process.env.PLUGGY_CLIENT_ID ? `${process.env.PLUGGY_CLIENT_ID.substring(0, 8)}...` : "MISSING",
      PLUGGY_CLIENT_SECRET: process.env.PLUGGY_CLIENT_SECRET ? `${process.env.PLUGGY_CLIENT_SECRET.substring(0, 8)}...` : "MISSING",
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "MISSING",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? `${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 10)}...` : "MISSING",
    };

    // 2. Testar autenticação Pluggy
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
      if (authRes.ok) {
        const authData = JSON.parse(authBody);
        checks.pluggyAuth = {
          status: "OK",
          httpStatus: authRes.status,
          hasApiKey: !!authData.apiKey,
        };
      } else {
        checks.pluggyAuth = {
          status: "FAILED",
          httpStatus: authRes.status,
          body: authBody.substring(0, 500),
        };
      }
    } catch (authError) {
      checks.pluggyAuth = {
        status: "ERROR",
        message: authError instanceof Error ? authError.message : String(authError),
      };
    }

    // 3. Testar Supabase REST API — verificar cada tabela
    const tables = ["pluggy_items", "accounts", "transactions", "credit_cards", "investments", "loans", "insights_cache", "credit_score"];
    const tableChecks: Record<string, unknown> = {};

    for (const table of tables) {
      const { data, error, count } = await supabaseSelect(table, {
        select: "id",
        limit: 1,
        count: true,
      });

      if (error) {
        tableChecks[table] = { status: "ERROR", ...error };
      } else {
        tableChecks[table] = { status: "OK", count: count ?? 0, sample: data?.length ?? 0 };
      }
    }

    checks.supabase = { status: "OK", restApi: true, tables: tableChecks };

    return NextResponse.json({ checks });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
      checks,
    }, { status: 500 });
  }
}

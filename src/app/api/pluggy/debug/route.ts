import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

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
          apiKeyPrefix: authData.apiKey ? `${authData.apiKey.substring(0, 20)}...` : null,
        };

        // 3. Testar listagem de items
        try {
          const itemsRes = await fetch(`${PLUGGY_BASE_URL}/items?page=1`, {
            headers: {
              "Content-Type": "application/json",
              "X-API-KEY": authData.apiKey,
            },
          });
          const itemsBody = await itemsRes.text();
          if (itemsRes.ok) {
            const itemsData = JSON.parse(itemsBody);
            checks.pluggyItems = {
              status: "OK",
              httpStatus: itemsRes.status,
              total: itemsData.total,
              resultsCount: itemsData.results?.length || 0,
              items: (itemsData.results || []).map((item: { id: string; status: string; connector: { name: string } }) => ({
                id: item.id,
                connector: item.connector?.name,
                status: item.status,
              })),
            };
          } else {
            checks.pluggyItems = {
              status: "FAILED",
              httpStatus: itemsRes.status,
              body: itemsBody.substring(0, 500),
            };
          }
        } catch (itemsError) {
          checks.pluggyItems = {
            status: "ERROR",
            message: itemsError instanceof Error ? itemsError.message : String(itemsError),
          };
        }
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

    // 4. Testar conexão Supabase e verificar tabelas
    try {
      const supabase = createSupabaseServer();
      const tables = ["pluggy_items", "accounts", "transactions", "credit_cards", "investments", "loans", "insights_cache", "credit_score"];
      const tableChecks: Record<string, unknown> = {};

      for (const table of tables) {
        const { error, count } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });

        if (error) {
          tableChecks[table] = { status: "ERROR", code: error.code, message: error.message };
        } else {
          tableChecks[table] = { status: "OK", count: count ?? 0 };
        }
      }

      checks.supabase = { status: "OK", tables: tableChecks };
    } catch (dbError) {
      checks.supabase = {
        status: "ERROR",
        message: dbError instanceof Error ? dbError.message : String(dbError),
      };
    }

    return NextResponse.json({ checks });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
      checks,
    }, { status: 500 });
  }
}

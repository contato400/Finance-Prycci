import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

// Salva score de crédito
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const { score, source } = (await request.json()) as { score: number; source?: string };

    if (typeof score !== "number" || score < 0 || score > 1000) {
      return NextResponse.json({ error: "Score deve ser entre 0 e 1000" }, { status: 400 });
    }

    const today = new Date().toISOString().split("T")[0];
    const [row] = await sql`
      INSERT INTO credit_score (user_id, score, source, recorded_at, updated_at)
      VALUES (${userId}, ${score}, ${source || "FinanceOS"}, ${today}, now())
      RETURNING *
    `;

    return NextResponse.json({ score: row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar score";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

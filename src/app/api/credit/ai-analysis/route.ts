import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

const infosBancos: Record<string, string> = {
  "Nubank": "digital, rotativo ~17%/mês, CDB 100% CDI",
  "Banco Inter": "digital, rotativo ~15%/mês, Inter Invest",
  "Caixa Econômica Federal": "público, imobiliário ~8-9%aa, consignado ~1.8%/mês",
  "Nubank Empresas": "PJ, sem tarifas, limite separado",
  "Bradesco": "tradicional, crédito ~4-6%/mês",
  "Itaú": "tradicional, crédito ~3-5%/mês",
  "Santander": "crédito ~4-6%/mês",
};

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY não configurada" }, { status: 500 });

    const [incomeRow, expenseRow, creditRow, investRow, banksRows] = await Promise.all([
      sql`SELECT COALESCE(SUM(amount), 0)::float AS total FROM transactions WHERE user_id = ${userId} AND amount > 0 AND date >= NOW() - INTERVAL '30 days'`,
      sql`SELECT COALESCE(SUM(ABS(amount)), 0)::float AS total FROM transactions WHERE user_id = ${userId} AND amount < 0 AND date >= NOW() - INTERVAL '30 days'`,
      sql`SELECT COALESCE(SUM(ABS(balance)), 0)::float AS used, COALESCE(SUM(COALESCE(credit_limit, 0)), 0)::float AS lim FROM accounts WHERE user_id = ${userId} AND type IN ('CREDIT','CREDIT_CARD')`,
      sql`SELECT COALESCE(SUM(balance), 0)::float AS total FROM investments WHERE user_id = ${userId}`,
      sql`SELECT institution_name FROM pluggy_items WHERE user_id = ${userId}`,
    ]);

    const receita = num(incomeRow[0]?.total);
    const gastos = num(expenseRow[0]?.total);
    const creditUsed = num(creditRow[0]?.used);
    const creditLimit = num(creditRow[0]?.lim);
    const investido = num(investRow[0]?.total);
    const bancosInfo = banksRows.map((b) => `${b.institution_name} (${infosBancos[String(b.institution_name)] || "banco conectado"})`).join(", ");

    const prompt = `Você é um consultor de crédito brasileiro. Analise a situação de crédito do usuário e escreva 3 parágrafos curtos em português. Texto limpo sem markdown.

Dados: Receita R$${receita.toFixed(0)}, Gastos R$${gastos.toFixed(0)}, Crédito usado R$${creditUsed.toFixed(0)} de R$${creditLimit.toFixed(0)} limite, Investido R$${investido.toFixed(0)}, Bancos: ${bancosInfo || "nenhum"}.

Parágrafo 1: Situação do crédito com valores reais.
Parágrafo 2: Riscos e oportunidades nos bancos específicos.
Parágrafo 3: Recomendação prática e direta.

Responda APENAS com JSON: {"analise":"Parágrafo 1.\\n\\nParágrafo 2.\\n\\nParágrafo 3."}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 1024, responseMimeType: "application/json" },
        }),
      }
    );

    if (!res.ok) return NextResponse.json({ error: `Gemini erro: ${res.status}` }, { status: 500 });

    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    let jsonText = "";
    for (const part of parts) {
      if (part.text) { const m = part.text.match(/\{[\s\S]*\}/); if (m) { jsonText = m[0]; break; } }
    }

    let raw: Record<string, unknown> = {};
    try { raw = JSON.parse(jsonText); } catch { /* */ }

    const analise = String(raw.analise || raw.análise || "Análise indisponível.")
      .replace(/\*\*/g, "").replace(/\*/g, "").replace(/^#+\s*/gm, "");

    return NextResponse.json({ analise });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro" }, { status: 500 });
  }
}

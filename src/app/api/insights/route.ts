import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY não configurada" }, { status: 500 });
    }

    // Buscar dados financeiros do usuário
    const [
      balanceRow,
      creditRow,
      investRow,
      categoriesRows,
      topExpensesRows,
      incomeRow,
      banksRows,
    ] = await Promise.all([
      sql`SELECT COALESCE(SUM(balance), 0)::float AS total FROM accounts WHERE user_id = ${userId} AND type NOT IN ('CREDIT','CREDIT_CARD')`,
      sql`SELECT COALESCE(SUM(ABS(balance)), 0)::float AS used, COALESCE(SUM(COALESCE(credit_limit, 0)), 0)::float AS lim FROM accounts WHERE user_id = ${userId} AND type IN ('CREDIT','CREDIT_CARD')`,
      sql`SELECT COALESCE(SUM(balance), 0)::float AS total, COUNT(*)::int AS count FROM investments WHERE user_id = ${userId}`,
      sql`SELECT COALESCE(category, 'Outros') AS category, SUM(ABS(amount))::float AS total
          FROM transactions WHERE user_id = ${userId} AND amount < 0 AND date >= NOW() - INTERVAL '30 days'
          GROUP BY category ORDER BY total DESC LIMIT 8`,
      sql`SELECT description, ABS(amount)::float AS valor, date::text AS date
          FROM transactions WHERE user_id = ${userId} AND amount < 0 AND date >= NOW() - INTERVAL '30 days'
          ORDER BY ABS(amount) DESC LIMIT 5`,
      sql`SELECT COALESCE(SUM(amount), 0)::float AS total
          FROM transactions WHERE user_id = ${userId} AND amount > 0 AND date >= NOW() - INTERVAL '30 days'`,
      sql`SELECT institution_name FROM pluggy_items WHERE user_id = ${userId}`,
    ]);

    const saldo = num(balanceRow[0]?.total);
    const creditoUsado = num(creditRow[0]?.used);
    const creditoLimite = num(creditRow[0]?.lim);
    const investido = num(investRow[0]?.total);
    const qtdInvestimentos = num(investRow[0]?.count);
    const receitaMensal = num(incomeRow[0]?.total);
    const bancos = banksRows.map((b) => b.institution_name).join(", ");

    const gastosPorCategoria = categoriesRows
      .map((c) => `- ${c.category}: R$ ${num(c.total).toFixed(2)}`)
      .join("\n");

    const maioresGastos = topExpensesRows
      .map((t) => `- ${t.description}: R$ ${num(t.valor).toFixed(2)} (${t.date})`)
      .join("\n");

    const gastoTotal = categoriesRows.reduce((s, c) => s + num(c.total), 0);

    const prompt = `Você é um consultor financeiro pessoal brasileiro. Analise os dados financeiros abaixo e forneça uma análise personalizada em português brasileiro.

DADOS DO USUÁRIO:
- Saldo em contas correntes: R$ ${saldo.toFixed(2)}
- Receita dos últimos 30 dias: R$ ${receitaMensal.toFixed(2)}
- Gasto total dos últimos 30 dias: R$ ${gastoTotal.toFixed(2)}
- Crédito utilizado: R$ ${creditoUsado.toFixed(2)} de R$ ${creditoLimite.toFixed(2)} limite
- Total investido: R$ ${investido.toFixed(2)} (${qtdInvestimentos} ativos)
- Bancos conectados: ${bancos || "nenhum"}

GASTOS POR CATEGORIA (últimos 30 dias):
${gastosPorCategoria || "Sem dados de gastos"}

MAIORES GASTOS:
${maioresGastos || "Sem transações recentes"}

Responda EXATAMENTE neste formato JSON (sem markdown, sem backticks, sem blocos de código):
{
  "resumo": "Parágrafo com resumo geral da situação financeira",
  "pontos_atencao": ["item 1", "item 2", "item 3"],
  "recomendacoes": ["recomendação 1", "recomendação 2", "recomendação 3"],
  "proximos_passos": ["passo 1", "passo 2", "passo 3"],
  "score_saude": 7
}

O score_saude é de 1 a 10 (10 = saúde financeira excelente).
Seja direto, prático e use valores em R$.`;

    // Chamar Google Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error("Gemini API error:", geminiRes.status, errBody);
      return NextResponse.json({ error: `Gemini API erro: ${geminiRes.status}` }, { status: 500 });
    }

    const geminiData = await geminiRes.json();

    // Gemini 2.5-flash pode retornar múltiplos parts (thinking + response)
    // Pegar TODOS os parts e concatenar, ou pegar o último que geralmente é a resposta
    const parts = geminiData?.candidates?.[0]?.content?.parts || [];
    let text = "";

    // Percorrer todos os parts e pegar o que contém JSON
    for (const part of parts) {
      if (part.text) {
        text = part.text;
      }
    }

    // Limpar markdown wrappers e extrair JSON
    text = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    // Se o texto contém JSON embutido em outras coisas, extrair o bloco JSON
    const jsonMatch = text.match(/\{[\s\S]*"resumo"[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    }

    // Parse do JSON da resposta
    let analysis;
    try {
      analysis = JSON.parse(text);
    } catch {
      analysis = {
        resumo: text.slice(0, 500),
        pontos_atencao: [],
        recomendacoes: [],
        proximos_passos: [],
        score_saude: 5,
      };
    }

    return NextResponse.json({
      analysis,
      generatedAt: new Date().toISOString(),
      dataSnapshot: {
        saldo, receitaMensal, gastoTotal, creditoUsado, creditoLimite, investido,
      },
    });
  } catch (error) {
    console.error("Insights error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Erro ao gerar análise",
    }, { status: 500 });
  }
}

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

    const { message, history } = (await request.json()) as {
      message: string;
      history: Array<{ role: string; content: string }>;
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
    }

    // Buscar dados financeiros do usuário
    const [balanceRow, creditRow, investRow, categoriesRows, topExpensesRows, incomeRow, banksRows] = await Promise.all([
      sql`SELECT COALESCE(SUM(balance), 0)::float AS total FROM accounts WHERE user_id = ${userId} AND type NOT IN ('CREDIT','CREDIT_CARD')`,
      sql`SELECT COALESCE(SUM(ABS(balance)), 0)::float AS used, COALESCE(SUM(COALESCE(credit_limit, 0)), 0)::float AS lim FROM accounts WHERE user_id = ${userId} AND type IN ('CREDIT','CREDIT_CARD')`,
      sql`SELECT COALESCE(SUM(balance), 0)::float AS total, COUNT(*)::int AS count FROM investments WHERE user_id = ${userId}`,
      sql`SELECT COALESCE(category, 'Outros') AS category, SUM(ABS(amount))::float AS total FROM transactions WHERE user_id = ${userId} AND amount < 0 AND date >= NOW() - INTERVAL '30 days' GROUP BY category ORDER BY total DESC LIMIT 8`,
      sql`SELECT description, ABS(amount)::float AS valor, date::text AS date FROM transactions WHERE user_id = ${userId} AND amount < 0 AND date >= NOW() - INTERVAL '30 days' ORDER BY ABS(amount) DESC LIMIT 5`,
      sql`SELECT COALESCE(SUM(amount), 0)::float AS total FROM transactions WHERE user_id = ${userId} AND amount > 0 AND date >= NOW() - INTERVAL '30 days'`,
      sql`SELECT institution_name FROM pluggy_items WHERE user_id = ${userId}`,
    ]);

    const saldo = num(balanceRow[0]?.total);
    const creditoUsado = num(creditRow[0]?.used);
    const creditoLimite = num(creditRow[0]?.lim);
    const investido = num(investRow[0]?.total);
    const qtdInvestimentos = num(investRow[0]?.count);
    const receitaMensal = num(incomeRow[0]?.total);
    const gastoTotal = categoriesRows.reduce((s, c) => s + num(c.total), 0);
    const bancos = banksRows.map((b) => b.institution_name).join(", ");

    const gastosPorCategoria = categoriesRows
      .map((c) => `${c.category}: R$ ${num(c.total).toFixed(2)}`)
      .join(", ");

    const maioresGastos = topExpensesRows
      .map((t) => `${t.description}: R$ ${num(t.valor).toFixed(2)}`)
      .join(", ");

    const systemPrompt = `Você é um consultor financeiro pessoal brasileiro chamado Prycci. Responda sempre em português brasileiro, de forma direta e prática.

DADOS FINANCEIROS ATUAIS DO USUÁRIO:
- Saldo em contas: R$ ${saldo.toFixed(2)}
- Receita mensal (30 dias): R$ ${receitaMensal.toFixed(2)}
- Gastos mensais (30 dias): R$ ${gastoTotal.toFixed(2)}
- Saldo líquido: R$ ${(receitaMensal - gastoTotal).toFixed(2)}
- Crédito utilizado: R$ ${creditoUsado.toFixed(2)} de R$ ${creditoLimite.toFixed(2)} limite
- Investido: R$ ${investido.toFixed(2)} (${qtdInvestimentos} ativos)
- Bancos: ${bancos || "nenhum"}
- Gastos por categoria: ${gastosPorCategoria || "sem dados"}
- Maiores gastos: ${maioresGastos || "sem dados"}

Use esses dados reais para responder as perguntas do usuário. Seja específico com valores. Não invente dados.`;

    // Montar histórico para Gemini
    const contents = [];

    // System prompt como primeira mensagem do usuário
    contents.push({
      role: "user",
      parts: [{ text: systemPrompt + "\n\nResponda 'Entendido' para confirmar que recebeu os dados." }],
    });
    contents.push({
      role: "model",
      parts: [{ text: "Entendido. Tenho acesso aos seus dados financeiros atuais. Como posso ajudar?" }],
    });

    // Histórico anterior
    for (const msg of (history || [])) {
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      });
    }

    // Mensagem atual
    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
          responseMimeType: "text/plain",
        },
      }),
    });

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error("Gemini chat error:", geminiRes.status, errBody);
      return NextResponse.json({ error: `Erro na IA: ${geminiRes.status}` }, { status: 500 });
    }

    const geminiData = await geminiRes.json();
    const parts = geminiData?.candidates?.[0]?.content?.parts || [];
    const reply = parts.map((p: { text?: string }) => p.text || "").join("").trim();

    return NextResponse.json({
      reply: reply || "Desculpe, não consegui gerar uma resposta. Tente novamente.",
      dataSnapshot: { saldo, receitaMensal, gastoTotal, investido },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Erro no chat",
    }, { status: 500 });
  }
}

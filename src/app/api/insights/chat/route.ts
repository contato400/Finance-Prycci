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
    const receitaMensal = num(incomeRow[0]?.total);
    const gastoTotal = categoriesRows.reduce((s, c) => s + num(c.total), 0);
    const bancos = banksRows.map((b) => b.institution_name).join(", ");

    const saldoLiquido = receitaMensal - gastoTotal;
    const percentualCredito = creditoLimite > 0 ? ((creditoUsado / creditoLimite) * 100).toFixed(0) : "0";

    const gastosPorCategoria = categoriesRows
      .map((c) => `- ${c.category}: R$ ${num(c.total).toFixed(2)}`)
      .join("\n");

    const maioresGastos = topExpensesRows
      .map((t) => `- ${t.description}: R$ ${num(t.valor).toFixed(2)} (${t.date})`)
      .join("\n");

    const systemPrompt = `Você é um consultor financeiro pessoal especialista, integrado ao app Prycci Finance. Você tem acesso COMPLETO aos dados financeiros reais do usuário e deve usá-los em TODAS as respostas.

DADOS FINANCEIROS REAIS DO USUÁRIO (últimos 30 dias):
- Saldo em conta corrente: R$ ${saldo.toFixed(2)}
- Receita mensal: R$ ${receitaMensal.toFixed(2)}
- Gastos totais: R$ ${gastoTotal.toFixed(2)}
- Saldo líquido (receita - gastos): R$ ${saldoLiquido.toFixed(2)}
- Crédito utilizado: R$ ${creditoUsado.toFixed(2)} de R$ ${creditoLimite.toFixed(2)} (${percentualCredito}% do limite)
- Total investido: R$ ${investido.toFixed(2)}
- Bancos conectados: ${bancos || "nenhum"}

GASTOS POR CATEGORIA:
${gastosPorCategoria || "Sem dados"}

MAIORES TRANSAÇÕES INDIVIDUAIS:
${maioresGastos || "Sem dados"}

REGRAS DE COMPORTAMENTO:
1. Sempre responda em português brasileiro
2. Sempre cite valores reais do usuário nas respostas
3. Seja direto, prático e objetivo — máximo 4 parágrafos por resposta
4. Quando perguntarem sobre transações específicas, consulte os dados acima
5. Para dar conselhos sobre crédito, considere as taxas médias brasileiras:
   - Cartão de crédito rotativo: 15-20% ao mês
   - Empréstimo pessoal: 3-8% ao mês
   - Financiamento imobiliário: 0,7-1% ao mês
   - Crédito consignado: 1,5-2,5% ao mês
   - CDB: 100-120% CDI (Selic ~14,75% ao ano)
   - Tesouro Direto Selic: ~14,75% ao ano
6. Se o usuário perguntar se deve comprar algo, financiar ou pegar empréstimo, analise o impacto real nos dados dele e dê uma recomendação clara com base nos números
7. Se perguntarem sobre os últimos 7, 15 ou 30 dias, use os dados de transações disponíveis para dar uma resposta contextualizada
8. Aponte sempre oportunidades de melhoria baseadas nos dados reais
9. Nunca invente dados — use apenas o que está nos dados acima
10. Seja como um consultor da XP ou BTG: profissional, direto e embasado`;

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

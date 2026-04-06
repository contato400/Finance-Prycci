import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

const categoriasPT: Record<string, string> = {
  "Transfers": "Transferências", "Transfer": "Transferência",
  "Credit card payment": "Pagamento Cartão", "Investments": "Investimentos",
  "Transfer - Bank Slip": "Boleto Bancário", "Bank slip": "Boleto",
  "Same person transfer": "Transferência Própria", "Shopping": "Compras",
  "Groceries": "Mercado/Alimentação", "Transfer - PIX": "PIX",
  "Food and Drink": "Alimentação", "Food and drinks": "Alimentação",
  "Food delivery": "Delivery", "Transport": "Transporte",
  "Transportation": "Transporte", "Health": "Saúde",
  "Education": "Educação", "Entertainment": "Entretenimento",
  "Others": "Outros", "Other": "Outros",
  "Digital services": "Serviços Digitais", "Subscription": "Assinatura",
  "Taxi and ride-hailing": "Transporte (app)",
  "Hospital clinics and labs": "Saúde", "Supermarket": "Supermercado",
};

const infosBancos: Record<string, string> = {
  "Nubank": "Banco digital, sem tarifas, cartão de crédito com limite flexível, taxa do rotativo ~17% ao mês, Nubank Invest com CDB 100% CDI",
  "Banco Inter": "Banco digital completo, conta sem tarifas, cartão de crédito, investimentos CDB/fundos, taxa do rotativo ~15% ao mês, Inter Invest",
  "Caixa Econômica Federal": "Banco público, forte em financiamento imobiliário (menor taxa do mercado ~8-9% aa), FGTS, Poupança, crédito consignado ~1.8% ao mês",
  "Nubank Empresas": "Conta PJ Nubank, sem tarifas mensais, cartão PJ, limite separado da conta pessoal",
  "Bradesco": "Banco tradicional, tarifas mensais, ampla rede de agências, crédito pessoal ~4-6% ao mês",
  "Itaú": "Banco tradicional, tarifas mensais, produtos premium, crédito pessoal ~3-5% ao mês",
  "Santander": "Banco espanhol com operações no Brasil, tarifas mensais, crédito pessoal ~4-6% ao mês",
};

const trad = (cat: string): string => categoriasPT[cat] || cat;

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY não configurada" }, { status: 500 });
    }

    const [
      balanceRow, creditRow, investRow, categoriesRows,
      transacoesRows, incomeRow, banksRows, historicoRows, memorias,
    ] = await Promise.all([
      sql`SELECT COALESCE(SUM(balance), 0)::float AS total FROM accounts WHERE user_id = ${userId} AND type NOT IN ('CREDIT','CREDIT_CARD')`,
      sql`SELECT COALESCE(SUM(ABS(balance)), 0)::float AS used, COALESCE(SUM(COALESCE(credit_limit, 0)), 0)::float AS lim FROM accounts WHERE user_id = ${userId} AND type IN ('CREDIT','CREDIT_CARD')`,
      sql`SELECT COALESCE(SUM(balance), 0)::float AS total, COUNT(*)::int AS count FROM investments WHERE user_id = ${userId}`,
      sql`SELECT COALESCE(category, 'Outros') AS category, SUM(ABS(amount))::float AS total FROM transactions WHERE user_id = ${userId} AND amount < 0 AND date >= NOW() - INTERVAL '30 days' GROUP BY category ORDER BY total DESC LIMIT 8`,
      sql`SELECT description, amount::float, date::text, category, ABS(amount)::float AS valor FROM transactions WHERE user_id = ${userId} AND date >= NOW() - INTERVAL '90 days' ORDER BY date DESC LIMIT 100`,
      sql`SELECT COALESCE(SUM(amount), 0)::float AS total FROM transactions WHERE user_id = ${userId} AND amount > 0 AND date >= NOW() - INTERVAL '30 days'`,
      sql`SELECT institution_name FROM pluggy_items WHERE user_id = ${userId}`,
      sql`SELECT TO_CHAR(DATE_TRUNC('month', date), 'YYYY-MM') AS mes,
             COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::float AS receita,
             COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)::float AS gastos
           FROM transactions WHERE user_id = ${userId} AND date >= NOW() - INTERVAL '90 days'
           GROUP BY mes ORDER BY mes`,
      sql`SELECT type, content FROM ai_memory WHERE user_id = ${userId} ORDER BY updated_at DESC LIMIT 20`,
    ]);

    const saldo = num(balanceRow[0]?.total);
    const creditoUsado = num(creditRow[0]?.used);
    const creditoLimite = num(creditRow[0]?.lim);
    const investido = num(investRow[0]?.total);
    const receitaMensal = num(incomeRow[0]?.total);
    const gastoTotal = categoriesRows.reduce((s, c) => s + num(c.total), 0);
    const saldoLiquido = receitaMensal - gastoTotal;
    const percentualCredito = creditoLimite > 0 ? ((creditoUsado / creditoLimite) * 100).toFixed(0) : "0";

    const gastosPorCategoria = categoriesRows
      .map((c) => `- ${trad(String(c.category))}: R$ ${num(c.total).toFixed(2)}`)
      .join("\n");

    const listaTransacoes = transacoesRows.map((t) =>
      `${t.date} | ${num(t.amount) > 0 ? "RECEITA" : "GASTO"} | R$ ${num(t.valor).toFixed(2)} | ${t.description} | ${t.category || "Outros"}`
    ).join("\n");

    const historicoMensal = historicoRows
      .map((h) => `- ${h.mes}: Receita R$ ${num(h.receita).toFixed(2)} | Gastos R$ ${num(h.gastos).toFixed(2)} | Líquido R$ ${(num(h.receita) - num(h.gastos)).toFixed(2)}`)
      .join("\n");

    const bancosInfo = banksRows
      .map((b) => `- ${b.institution_name}: ${infosBancos[String(b.institution_name)] || "banco conectado"}`)
      .join("\n");

    const memoriasStr = memorias.length > 0
      ? memorias.map((m) => `[${m.type}] ${m.content}`).join("\n")
      : "Primeira análise — sem histórico ainda.";

    const prompt = `Você é um consultor financeiro pessoal brasileiro especialista. Analise os dados abaixo e escreva uma análise financeira personalizada em português brasileiro, sem usar markdown.

DADOS FINANCEIROS (últimos 30 dias):
- Saldo em contas: R$ ${saldo.toFixed(2)}
- Receita: R$ ${receitaMensal.toFixed(2)}
- Gastos: R$ ${gastoTotal.toFixed(2)}
- Saldo líquido: R$ ${saldoLiquido.toFixed(2)}
- Crédito: R$ ${creditoUsado.toFixed(2)} de R$ ${creditoLimite.toFixed(2)} (${percentualCredito}%)
- Investido: R$ ${investido.toFixed(2)}

HISTÓRICO MENSAL (3 meses):
${historicoMensal || "Sem histórico"}

GASTOS POR CATEGORIA:
${gastosPorCategoria || "Sem dados"}

TRANSAÇÕES DETALHADAS (últimos 90 dias):
${listaTransacoes || "Sem transações"}

BANCOS DO USUÁRIO:
${bancosInfo || "Nenhum banco conectado"}

Ao identificar comerciantes nas transações: UBER = transporte Uber, IFOOD = delivery, MERCADO/SUPERMERCADO = supermercado, FARMACIA/DROGARIA = farmácia, "Transferência enviada|NOME" = PIX para NOME. Use isso para dar análises mais humanas e precisas.

HISTÓRICO COMPORTAMENTAL (aprendido ao longo do tempo):
${memoriasStr}

Escreva uma análise em 4 parágrafos curtos e objetivos (texto corrido, sem listas, sem markdown, sem negrito):
1. Situação atual com valores reais
2. Pontos críticos que precisam de atenção
3. Recomendações práticas considerando os bancos do usuário
4. Próximos passos concretos

Responda APENAS com este JSON:
{"resumo":"frase curta de resumo","analise":"Parágrafo 1. Parágrafo 2. Parágrafo 3. Parágrafo 4.","score_saude":7}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 8192, responseMimeType: "application/json" },
      }),
    });

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error("Gemini error:", geminiRes.status, errBody);
      return NextResponse.json({ error: `Gemini API erro: ${geminiRes.status}` }, { status: 500 });
    }

    const geminiData = await geminiRes.json();
    const parts = geminiData?.candidates?.[0]?.content?.parts || [];
    let jsonText = "";
    for (const part of parts) {
      if (part.text) {
        const match = part.text.match(/\{[\s\S]*"score_saude"[\s\S]*\}/);
        if (match) { jsonText = match[0]; break; }
      }
    }
    if (!jsonText) {
      for (const part of parts) {
        if (part.text) { const m = part.text.match(/\{[\s\S]*\}/); if (m) { jsonText = m[0]; break; } }
      }
    }

    let raw: Record<string, unknown> = {};
    try { raw = JSON.parse(jsonText); } catch { raw = {}; }

    // Limpar markdown do texto
    const cleanMd = (s: string) => s.replace(/\*\*/g, "").replace(/\*/g, "").replace(/^#+\s*/gm, "").trim();

    const analysis = {
      resumo: cleanMd(String(raw.resumo || "Análise indisponível.")),
      analise: cleanMd(String(raw.analise || raw.análise || "")),
      score_saude: Number(raw.score_saude || 5),
    };

    return NextResponse.json({
      analysis,
      generatedAt: new Date().toISOString(),
      dataSnapshot: { saldo, receitaMensal, gastoTotal, creditoUsado, creditoLimite, investido },
      categories: categoriesRows.map((c) => ({ category: trad(String(c.category)), total: num(c.total) })),
    });
  } catch (error) {
    console.error("Insights error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro ao gerar análise" }, { status: 500 });
  }
}

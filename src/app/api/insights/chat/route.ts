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
  "Nubank": "Banco digital, sem tarifas, rotativo ~17%/mês, CDB 100% CDI",
  "Banco Inter": "Banco digital, sem tarifas, rotativo ~15%/mês, Inter Invest",
  "Caixa Econômica Federal": "Banco público, financiamento imobiliário ~8-9%aa, consignado ~1.8%/mês",
  "Nubank Empresas": "Conta PJ Nubank, sem tarifas, limite separado",
  "Bradesco": "Banco tradicional, crédito pessoal ~4-6%/mês",
  "Itaú": "Banco tradicional, crédito pessoal ~3-5%/mês",
  "Santander": "Banco espanhol, crédito pessoal ~4-6%/mês",
};

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY não configurada" }, { status: 500 });
    }

    const { message } = (await request.json()) as { message: string };
    if (!message?.trim()) {
      return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
    }

    // Buscar dados financeiros + memória + histórico + transações detalhadas
    const [
      balanceRow, creditRow, investRow, categoriesRows, transacoesRows,
      incomeRow, banksRows, historicoRows, memorias, chatHistory, loansRows, snapshotsRows,
    ] = await Promise.all([
      sql`SELECT COALESCE(SUM(balance), 0)::float AS total FROM accounts WHERE user_id = ${userId} AND type NOT IN ('CREDIT','CREDIT_CARD')`,
      sql`SELECT COALESCE(SUM(ABS(balance)), 0)::float AS used, COALESCE(SUM(COALESCE(credit_limit, 0)), 0)::float AS lim FROM accounts WHERE user_id = ${userId} AND type IN ('CREDIT','CREDIT_CARD')`,
      sql`SELECT COALESCE(SUM(i.balance), 0)::float AS total FROM investments i JOIN pluggy_items pi ON i.item_id = pi.id WHERE pi.user_id = ${userId}`,
      sql`SELECT COALESCE(category, 'Outros') AS category, SUM(ABS(amount))::float AS total FROM transactions WHERE user_id = ${userId} AND amount < 0 AND date >= NOW() - INTERVAL '30 days' GROUP BY category ORDER BY total DESC LIMIT 8`,
      sql`SELECT description, amount::float, date::text, category, ABS(amount)::float AS valor FROM transactions WHERE user_id = ${userId} AND date >= NOW() - INTERVAL '90 days' ORDER BY date DESC LIMIT 100`,
      sql`SELECT COALESCE(SUM(amount), 0)::float AS total FROM transactions WHERE user_id = ${userId} AND amount > 0 AND date >= NOW() - INTERVAL '30 days'`,
      sql`SELECT institution_name FROM pluggy_items WHERE user_id = ${userId}`,
      sql`SELECT TO_CHAR(DATE_TRUNC('month', date), 'YYYY-MM') AS mes,
             COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::float AS receita,
             COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)::float AS gastos
           FROM transactions WHERE user_id = ${userId} AND date >= NOW() - INTERVAL '90 days' GROUP BY mes ORDER BY mes`,
      sql`SELECT type, content FROM ai_memory WHERE user_id = ${userId} ORDER BY updated_at DESC LIMIT 20`,
      sql`SELECT role, content FROM ai_chat_history WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 20`,
      sql`SELECT l.institution_name, l.name, l.outstanding_balance::float, l.installment_amount::float, l.total_installments, l.paid_installments, l.interest_rate::float FROM loans l JOIN pluggy_items pi ON l.item_id = pi.id WHERE pi.user_id = ${userId}`,
      sql`SELECT month, receita::float, gastos::float, saldo::float, score_saude FROM financial_snapshots WHERE user_id = ${userId} ORDER BY month DESC LIMIT 12`,
    ]);

    const saldo = num(balanceRow[0]?.total);
    const creditoUsado = num(creditRow[0]?.used);
    const creditoLimite = num(creditRow[0]?.lim);
    const investido = num(investRow[0]?.total);
    const receitaMensal = num(incomeRow[0]?.total);
    const gastoTotal = categoriesRows.reduce((s, c) => s + num(c.total), 0);
    const saldoLiquido = receitaMensal - gastoTotal;
    const percentualCredito = creditoLimite > 0 ? ((creditoUsado / creditoLimite) * 100).toFixed(0) : "0";

    const gastosCat = categoriesRows.map((c) => `- ${c.category}: R$ ${num(c.total).toFixed(2)}`).join("\n");
    const histMensal = historicoRows.map((h) => `- ${h.mes}: Receita R$ ${num(h.receita).toFixed(2)} | Gastos R$ ${num(h.gastos).toFixed(2)}`).join("\n");
    const bancosInfo = banksRows.map((b) => `- ${b.institution_name}: ${infosBancos[String(b.institution_name)] || "banco conectado"}`).join("\n");
    const loansInfo = loansRows.length > 0
      ? loansRows.map((l) => `- ${l.institution_name}: ${l.name} | Saldo devedor: R$ ${num(l.outstanding_balance).toFixed(2)} | Parcela: R$ ${num(l.installment_amount).toFixed(2)} | ${l.paid_installments}/${l.total_installments} pagas | Taxa: ${num(l.interest_rate)}%`).join("\n")
      : "Nenhum empréstimo encontrado";
    const snapshotsInfo = snapshotsRows.length > 0
      ? snapshotsRows.map((s) => `${s.month}: Receita R$ ${num(s.receita).toFixed(0)} | Gastos R$ ${num(s.gastos).toFixed(0)} | Saldo R$ ${num(s.saldo).toFixed(0)} | Score ${s.score_saude}`).join("\n")
      : "Primeiro mês — sem histórico anterior";
    const memoriasStr = memorias.length > 0
      ? memorias.map((m) => `[${m.type}] ${m.content}`).join("\n")
      : "Nenhuma memória ainda — primeira interação.";

    const listaTransacoes = transacoesRows.map((t) =>
      `${t.date} | ${num(t.amount) > 0 ? "RECEITA" : "GASTO"} | R$ ${num(t.valor).toFixed(2)} | ${t.description} | ${t.category || "Outros"}`
    ).join("\n");

    const systemPrompt = `Você é um consultor financeiro pessoal especialista do app Prycci Finance.

DADOS FINANCEIROS REAIS (últimos 30 dias):
- Saldo: R$ ${saldo.toFixed(2)} | Receita: R$ ${receitaMensal.toFixed(2)} | Gastos: R$ ${gastoTotal.toFixed(2)} | Líquido: R$ ${saldoLiquido.toFixed(2)}
- Crédito: R$ ${creditoUsado.toFixed(2)} de R$ ${creditoLimite.toFixed(2)} (${percentualCredito}%) | Investido: R$ ${investido.toFixed(2)}

HISTÓRICO MENSAL (3 meses):
${histMensal || "Sem histórico"}

GASTOS POR CATEGORIA:
${gastosCat || "Sem dados"}

BANCOS:
${bancosInfo || "Nenhum"}

EMPRÉSTIMOS E FINANCIAMENTOS ATIVOS:
${loansInfo}

HISTÓRICO FINANCEIRO MENSAL (evolução ao longo do tempo):
${snapshotsInfo}

TRANSAÇÕES DETALHADAS (últimos 90 dias):
${listaTransacoes || "Sem transações"}

MEMÓRIA DO USUÁRIO (padrões e comportamentos identificados):
${memoriasStr}

INSTRUÇÕES PARA ANÁLISE DE TRANSAÇÕES:
- Quando perguntarem sobre um comerciante (Uber, iFood, Netflix, etc.), busque na lista por description contendo esse nome
- Quando perguntarem sobre últimos 7, 14 ou 30 dias, filtre pela coluna date
- Identifique padrões: gastos recorrentes, comerciantes frequentes, dias com mais gastos
- "UBER DO BRASIL TECNOLOGIA" = Uber, "IFOOD" = iFood, "MERCADO"/"SUPERMERCADO" = supermercado
- "Transferência enviada|NOME" = PIX para NOME, "Pagamento de fatura" = cartão de crédito
- Sempre some os valores quando perguntarem total gasto com X
- Seja preciso com datas e valores reais

REGRAS:
1. Português brasileiro, texto limpo (sem markdown/negrito/itálico)
2. Cite valores reais, máximo 4 parágrafos
3. Taxas BR: rotativo 15-20%/mês, pessoal 3-8%/mês, imobiliário 0.7-1%/mês, consignado 1.5-2.5%/mês, CDB 100-120% CDI, Selic ~14.75%/ano
4. Analise impacto real nos dados do usuário
5. Nunca invente dados`;

    // Montar histórico da conversa do banco (invertido para ordem cronológica)
    const dbHistory = [...chatHistory].reverse();

    const contents = [];
    contents.push({ role: "user", parts: [{ text: systemPrompt + "\nResponda 'Entendido'." }] });
    contents.push({ role: "model", parts: [{ text: "Entendido." }] });

    // Histórico anterior do banco
    for (const msg of dbHistory) {
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: String(msg.content) }],
      });
    }

    contents.push({ role: "user", parts: [{ text: message }] });

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048, responseMimeType: "text/plain" },
      }),
    });

    if (!geminiRes.ok) {
      return NextResponse.json({ error: `Erro na IA: ${geminiRes.status}` }, { status: 500 });
    }

    const geminiData = await geminiRes.json();
    const parts = geminiData?.candidates?.[0]?.content?.parts || [];
    let reply = parts.map((p: { text?: string }) => p.text || "").join("").trim();
    reply = reply.replace(/\*\*/g, "").replace(/\*/g, "").replace(/^#+\s*/gm, "");

    if (!reply) reply = "Desculpe, não consegui gerar uma resposta. Tente novamente.";

    // Salvar mensagem e resposta no histórico
    await sql`INSERT INTO ai_chat_history (user_id, role, content) VALUES (${userId}, 'user', ${message})`;
    await sql`INSERT INTO ai_chat_history (user_id, role, content) VALUES (${userId}, 'assistant', ${reply})`;

    // Extrair e salvar memórias em background (sem bloquear resposta)
    extractAndSaveMemory(apiKey, userId, message, reply).catch(() => {});

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro no chat" }, { status: 500 });
  }
}

async function extractAndSaveMemory(apiKey: string, userId: string, userMsg: string, aiReply: string) {
  try {
    const prompt = `Com base nessa conversa financeira, identifique SE HOUVER novos padrões comportamentais específicos do usuário.

Mensagem do usuário: "${userMsg}"
Resposta da IA: "${aiReply}"

Identifique padrões como:
- Comerciantes frequentes (ex: "Usa Uber regularmente")
- Gastos recorrentes (ex: "Paga academia todo mês")
- Comportamento com crédito (ex: "Costuma ultrapassar limite")
- Objetivos mencionados (ex: "Quer quitar cartão até junho")
- Renda irregular ou regular
Seja específico e use nomes reais dos comerciantes.

Responda APENAS com JSON válido:
{"memories":[{"type":"pattern","content":"texto curto"}]}
ou {"memories":[]} se não houver nada relevante.
Tipos: pattern, goal, alert, behavior. Máximo 2 memories.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 256, responseMimeType: "application/json" },
        }),
      }
    );

    if (!res.ok) return;

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const parsed = JSON.parse(jsonMatch[0]);
    const memories = Array.isArray(parsed.memories) ? parsed.memories : [];

    for (const mem of memories.slice(0, 2)) {
      if (mem.type && mem.content) {
        await sql`INSERT INTO ai_memory (user_id, type, content) VALUES (${userId}, ${mem.type}, ${mem.content})`;
      }
    }
  } catch {
    // Silencioso — memória é best-effort
  }
}

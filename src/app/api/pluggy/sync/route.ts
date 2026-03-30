import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPluggyClient } from "@/lib/pluggy/client";
import sql from "@/lib/db";
import type { Transaction as PluggyTransaction } from "pluggy-sdk";

type LogFn = (msg: string) => void;
type Pluggy = ReturnType<typeof createPluggyClient>;

export async function POST() {
  const logs: string[] = [];
  const log: LogFn = (msg) => { logs.push(`[${new Date().toISOString()}] ${msg}`); };

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    if (!(process.env.PLUGGY_CLIENT_ID || "").trim()) {
      return NextResponse.json({ error: "PLUGGY_CLIENT_ID não configurado", logs }, { status: 500 });
    }
    if (!(process.env.DATABASE_URL || "").trim()) {
      return NextResponse.json({ error: "DATABASE_URL não configurada", logs }, { status: 500 });
    }

    log("Iniciando sincronização...");

    log("Testando PostgreSQL...");
    try {
      const [{ total }] = await sql`SELECT count(*) as total FROM pluggy_items`;
      log(`PostgreSQL OK — ${total} items no banco`);
    } catch (dbErr) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      log(`PostgreSQL ERRO: ${msg}`);
      return NextResponse.json({ error: `DB: ${msg}`, logs }, { status: 500 });
    }

    const savedItems = await sql<{ id: string; item_id: string; institution_name: string }[]>`
      SELECT id, item_id, institution_name FROM pluggy_items ORDER BY created_at DESC
    `;

    if (savedItems.length === 0) {
      log("Nenhum item no banco");
      return NextResponse.json({
        message: "Nenhum banco conectado. Use 'Adicionar Banco' no Dashboard.",
        synced: false, itemsFound: 0, logs,
      });
    }

    log(`${savedItems.length} item(s) encontrado(s)`);

    const pluggy = createPluggyClient();
    const results = {
      itemsFound: savedItems.length, itemsSynced: 0,
      bankAccounts: 0, creditAccounts: 0, creditCards: 0,
      transactions: 0, investments: 0, loans: 0,
    };
    const itemErrors: Array<{ itemId: string; institution: string; error: string }> = [];

    // Processar items em PARALELO para velocidade
    const syncPromises = savedItems.map(async (dbItem) => {
      try {
        log(`Sincronizando ${dbItem.institution_name} (${dbItem.item_id})...`);
        const item = await pluggy.fetchItem(dbItem.item_id);
        log(`  Status: ${item.status}`);

        await sql`
          UPDATE pluggy_items SET status = ${item.status}, institution_name = ${item.connector.name}
          WHERE id = ${dbItem.id}::uuid
        `;

        // Contas primeiro (precisamos dos IDs para transações)
        const acctResult = await syncAccounts(pluggy, dbItem, item.connector.name, log);

        // Transações, investimentos e empréstimos em paralelo
        const [txCount, invCount, loanCount] = await Promise.all([
          syncTransactions(pluggy, dbItem, log),
          syncInvestments(pluggy, dbItem, log),
          syncLoans(pluggy, dbItem, item.connector.name, log),
        ]);

        log(`  RESUMO ${dbItem.institution_name}: ${acctResult.bankAccounts} banco, ${acctResult.creditAccounts} crédito, ${acctResult.creditCards} cartões, ${txCount} tx`);

        return {
          ok: true as const,
          bankAccounts: acctResult.bankAccounts,
          creditAccounts: acctResult.creditAccounts,
          creditCards: acctResult.creditCards,
          transactions: txCount,
          investments: invCount,
          loans: loanCount,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`  ERRO ${dbItem.institution_name}: ${msg}`);
        itemErrors.push({ itemId: dbItem.item_id, institution: dbItem.institution_name, error: msg });
        return { ok: false as const };
      }
    });

    const syncResults = await Promise.all(syncPromises);

    for (const r of syncResults) {
      if (r.ok) {
        results.itemsSynced++;
        results.bankAccounts += r.bankAccounts;
        results.creditAccounts += r.creditAccounts;
        results.creditCards += r.creditCards;
        results.transactions += r.transactions;
        results.investments += r.investments;
        results.loans += r.loans;
      }
    }

    log(`Finalizado: ${results.itemsSynced}/${results.itemsFound} — ${results.bankAccounts} contas, ${results.creditCards} cartões, ${results.transactions} transações`);

    // Construir cache do dashboard após sync
    log("Construindo cache do dashboard...");
    try {
      await buildDashboardCache(log);
      log("Cache do dashboard atualizado");
    } catch (cacheErr) {
      log(`Erro ao construir cache: ${cacheErr instanceof Error ? cacheErr.message : String(cacheErr)}`);
    }

    return NextResponse.json({
      message: `${results.itemsSynced} de ${results.itemsFound} bancos sincronizados.`,
      synced: results.itemsSynced > 0, results,
      itemErrors: itemErrors.length > 0 ? itemErrors : undefined, logs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`ERRO FATAL: ${message}`);
    return NextResponse.json({ error: message, logs }, { status: 500 });
  }
}

// Sincroniza TODAS as contas: tipo BANK (corrente/poupança) + tipo CREDIT (cartões)
async function syncAccounts(
  pluggy: Pluggy, dbItem: { id: string; item_id: string },
  institutionName: string, log: LogFn
) {
  let bankAccounts = 0, creditAccounts = 0, creditCards = 0;

  // Buscar TODAS as contas (sem filtro de tipo)
  const { results: accounts } = await pluggy.fetchAccounts(dbItem.item_id);
  log(`  Pluggy retornou ${accounts.length} contas`);

  for (const account of accounts) {
    try {
      // Logar dados brutos para debug
      log(`  Conta: type=${account.type} subtype=${account.subtype} name="${account.name}" balance=${account.balance} number=${account.number || "—"}`);
      if (account.creditData) {
        log(`    creditData: creditLimit=${account.creditData.creditLimit} availableCreditLimit=${account.creditData.availableCreditLimit} brand=${account.creditData.brand}`);
      }

      // Determinar o balance correto:
      // - BANK: usar account.balance diretamente
      // - CREDIT: balance é o valor da fatura (geralmente negativo = deve), usar valor absoluto
      const isCreditAccount = account.type === "CREDIT";
      const balance = account.balance;
      const creditLimit = account.creditData?.creditLimit || 0;

      // Salvar conta no banco
      const [upserted] = await sql`
        INSERT INTO accounts (item_id, pluggy_account_id, name, type, balance, credit_limit, currency, updated_at)
        VALUES (
          ${dbItem.id}::uuid,
          ${account.id},
          ${account.name},
          ${account.subtype || account.type},
          ${balance},
          ${creditLimit},
          ${account.currencyCode},
          now()
        )
        ON CONFLICT (pluggy_account_id) DO UPDATE SET
          name = EXCLUDED.name, type = EXCLUDED.type, balance = EXCLUDED.balance,
          credit_limit = EXCLUDED.credit_limit, currency = EXCLUDED.currency, updated_at = now()
        RETURNING id
      `;

      if (isCreditAccount) {
        creditAccounts++;
      } else {
        bankAccounts++;
      }

      // Se é conta de crédito, criar/atualizar registro na tabela credit_cards
      if (isCreditAccount && upserted) {
        const cd = account.creditData;
        // Saldo usado do cartão: valor absoluto do balance da conta de crédito
        const usedBalance = Math.abs(balance);
        const cardCreditLimit = cd?.creditLimit || 0;
        const availableLimit = cd?.availableCreditLimit || 0;
        const brand = cd?.brand || "";
        const last4 = account.number?.slice(-4) || "****";
        const cardName = `${institutionName} ${brand}`.trim();

        log(`    Cartão: ${cardName} final ${last4} — usado=${usedBalance} limite=${cardCreditLimit} disponível=${availableLimit}`);

        await sql`
          INSERT INTO credit_cards (account_id, name, last4, balance, credit_limit, available_limit, updated_at)
          VALUES (
            ${upserted.id}::uuid,
            ${cardName},
            ${last4},
            ${usedBalance},
            ${cardCreditLimit},
            ${availableLimit},
            now()
          )
          ON CONFLICT (account_id) DO UPDATE SET
            name = EXCLUDED.name, last4 = EXCLUDED.last4, balance = EXCLUDED.balance,
            credit_limit = EXCLUDED.credit_limit, available_limit = EXCLUDED.available_limit, updated_at = now()
        `;
        creditCards++;
      }
    } catch (e) {
      log(`  Erro conta ${account.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { bankAccounts, creditAccounts, creditCards };
}

// Sincroniza transações de TODAS as contas (BANK + CREDIT)
async function syncTransactions(pluggy: Pluggy, dbItem: { id: string; item_id: string }, log: LogFn) {
  let totalCount = 0;

  // Buscar TODAS as contas deste item no DB (incluindo cartões de crédito)
  const dbAccounts = await sql<{ id: string; pluggy_account_id: string; type: string }[]>`
    SELECT id, pluggy_account_id, type FROM accounts WHERE item_id = ${dbItem.id}::uuid
  `;
  if (!dbAccounts.length) {
    log("  Nenhuma conta no DB para buscar transações");
    return 0;
  }

  log(`  Buscando transações de ${dbAccounts.length} contas (${dbAccounts.map((a) => a.type).join(", ")})...`);

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 30);
  const from = fromDate.toISOString().split("T")[0];

  for (const acct of dbAccounts) {
    try {
      const txs = await pluggy.fetchAllTransactions(acct.pluggy_account_id, { from });
      log(`  ${txs.length} transações da conta ${acct.type} (${acct.pluggy_account_id.substring(0, 8)}...)`);

      if (txs.length === 0) continue;

      // Inserir uma a uma (seguro para transaction pooler sem prepare)
      for (const tx of txs as PluggyTransaction[]) {
        const txDate = typeof tx.date === "string" ? tx.date : new Date(tx.date).toISOString().split("T")[0];
        await sql`
          INSERT INTO transactions (account_id, pluggy_transaction_id, description, amount, date, category, type)
          VALUES (
            ${acct.id}::uuid,
            ${tx.id},
            ${tx.description},
            ${tx.amount},
            ${txDate},
            ${tx.category || null},
            ${tx.type}
          )
          ON CONFLICT (pluggy_transaction_id) DO UPDATE SET
            description = EXCLUDED.description, amount = EXCLUDED.amount,
            date = EXCLUDED.date, category = EXCLUDED.category, type = EXCLUDED.type
        `;
      }
      totalCount += txs.length;
    } catch (e) {
      log(`  Erro tx conta ${acct.type} ${acct.pluggy_account_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  log(`  Total transações sincronizadas: ${totalCount}`);
  return totalCount;
}

async function syncInvestments(pluggy: Pluggy, dbItem: { id: string; item_id: string }, log: LogFn) {
  let count = 0;
  try {
    const { results: invs } = await pluggy.fetchInvestments(dbItem.item_id);
    log(`  ${invs.length} investimentos`);
    for (const inv of invs) {
      await sql`
        INSERT INTO investments (item_id, pluggy_investment_id, name, type, balance, quantity, value, updated_at)
        VALUES (${dbItem.id}::uuid, ${inv.id}, ${inv.name}, ${inv.type},
                ${inv.balance}, ${inv.quantity || 0}, ${inv.value || 0}, now())
        ON CONFLICT (pluggy_investment_id) DO UPDATE SET
          name = EXCLUDED.name, type = EXCLUDED.type, balance = EXCLUDED.balance,
          quantity = EXCLUDED.quantity, value = EXCLUDED.value, updated_at = now()
      `;
      count++;
    }
  } catch (e) { log(`  Investimentos indisponíveis: ${e instanceof Error ? e.message : String(e)}`); }
  return count;
}

async function syncLoans(
  pluggy: Pluggy, dbItem: { id: string; item_id: string },
  institutionName: string, log: LogFn
) {
  let count = 0;
  try {
    const { results: loans } = await pluggy.fetchLoans(dbItem.item_id);
    log(`  ${loans.length} empréstimos`);
    for (const loan of loans) {
      await sql`
        INSERT INTO loans (item_id, pluggy_loan_id, institution_name, name, total_amount,
          installment_amount, total_installments, paid_installments, outstanding_balance, interest_rate, updated_at)
        VALUES (${dbItem.id}::uuid, ${loan.id}, ${institutionName}, ${loan.productName},
                ${loan.contractAmount || 0}, ${0}, ${loan.installments?.totalNumberOfInstallments || 0},
                ${loan.installments?.paidInstallments || 0}, ${loan.payments?.contractOutstandingBalance || 0},
                ${loan.CET || 0}, now())
        ON CONFLICT (pluggy_loan_id) DO UPDATE SET
          institution_name = EXCLUDED.institution_name, name = EXCLUDED.name,
          total_amount = EXCLUDED.total_amount, total_installments = EXCLUDED.total_installments,
          paid_installments = EXCLUDED.paid_installments, outstanding_balance = EXCLUDED.outstanding_balance,
          interest_rate = EXCLUDED.interest_rate, updated_at = now()
      `;
      count++;
    }
  } catch (e) { log(`  Empréstimos indisponíveis: ${e instanceof Error ? e.message : String(e)}`); }
  return count;
}

// Constrói o cache do dashboard a partir dos dados já sincronizados no banco
async function buildDashboardCache(log: LogFn) {
  // 3 queries simples, sem JOIN
  const [accountsByType, itemsList, investTotal] = await Promise.all([
    sql`SELECT type,
               SUM(balance)::float AS total_balance,
               SUM(COALESCE(credit_limit, 0))::float AS total_limit,
               COUNT(*)::int AS qty
        FROM accounts GROUP BY type`,
    sql`SELECT id, institution_name FROM pluggy_items`,
    sql`SELECT COALESCE(SUM(balance), 0)::float AS total FROM investments`,
  ]);

  const num = (v: unknown) => { const n = Number(v); return isNaN(n) ? 0 : n; };

  let totalBalance = 0;
  let totalCreditUsed = 0;
  let totalCreditLimit = 0;

  for (const row of accountsByType) {
    const isCredit = row.type === "CREDIT" || row.type === "CREDIT_CARD";
    if (isCredit) {
      totalCreditUsed += Math.abs(num(row.total_balance));
      totalCreditLimit += num(row.total_limit);
    } else {
      totalBalance += num(row.total_balance);
    }
  }

  const totalInvested = num(investTotal[0]?.total);
  const netBalance = totalBalance - totalCreditUsed;

  // Instituições com saldos — query separada sem JOIN
  const accountsDetail = await sql`SELECT item_id, type, balance::float AS balance,
    COALESCE(credit_limit, 0)::float AS credit_limit FROM accounts`;

  const itemMap = new Map<string, string>();
  for (const i of itemsList) itemMap.set(i.id, i.institution_name);

  const instMap = new Map<string, { name: string; balance: number; creditLimit: number; creditUsed: number }>();
  for (const a of accountsDetail) {
    const name = itemMap.get(a.item_id) || "Desconhecido";
    const e = instMap.get(name) || { name, balance: 0, creditLimit: 0, creditUsed: 0 };
    const isCredit = a.type === "CREDIT" || a.type === "CREDIT_CARD";
    if (isCredit) {
      e.creditLimit += num(a.credit_limit);
      e.creditUsed += Math.abs(num(a.balance));
    } else {
      e.balance += num(a.balance);
    }
    instMap.set(name, e);
  }

  // Gráfico de saldo (30 dias) — query agrupada
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const txData = await sql`
    SELECT date::text AS date, SUM(amount)::float AS total
    FROM transactions WHERE date >= ${thirtyDaysAgo}
    GROUP BY date ORDER BY date`;

  const txByDay = new Map<string, number>();
  for (const tx of txData) txByDay.set(tx.date, num(tx.total));

  const balanceHistory: { date: string; balance: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const dayDelta = txByDay.get(dateStr) || 0;
    balanceHistory.push({
      date: dateStr,
      balance: Math.round((totalBalance - dayDelta * (i / 10)) * 100) / 100,
    });
  }

  const cacheData = {
    totalBalance,
    totalCreditUsed,
    totalCreditLimit,
    totalInvested,
    netBalance,
    institutions: Array.from(instMap.values()),
    balanceHistory,
    connectedBanks: itemsList.length,
  };

  // Upsert na tabela de cache
  await sql`
    INSERT INTO dashboard_cache (id, data, updated_at)
    VALUES (1, ${JSON.stringify(cacheData)}::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET
      data = EXCLUDED.data,
      updated_at = EXCLUDED.updated_at
  `;

  log(`  Cache: saldo=${totalBalance} crédito=${totalCreditUsed}/${totalCreditLimit} investido=${totalInvested} bancos=${itemsList.length}`);
}

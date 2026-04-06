import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { createPluggyClient } from "@/lib/pluggy/client";
import sql from "@/lib/db";
import type { Transaction as PluggyTransaction } from "pluggy-sdk";

export const dynamic = "force-dynamic";

type LogFn = (msg: string) => void;
type Pluggy = ReturnType<typeof createPluggyClient>;

// IMPORTANTE: todo retorno deve ser Response.json() — nunca texto puro
export async function POST(request: Request) {
  const logs: string[] = [];
  const log: LogFn = (msg) => { logs.push(`[${new Date().toISOString()}] ${msg}`); };

  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const pluggyId = (process.env.PLUGGY_CLIENT_ID || "").trim();
    const pluggySecret = (process.env.PLUGGY_CLIENT_SECRET || "").trim();
    const dbUrl = (process.env.DATABASE_URL || "").trim();

    if (!pluggyId || !pluggySecret) {
      return Response.json({ error: "PLUGGY_CLIENT_ID/SECRET não configurados", logs }, { status: 500 });
    }
    if (!dbUrl) {
      return Response.json({ error: "DATABASE_URL não configurada", logs }, { status: 500 });
    }

    log("Iniciando sincronização...");

    // Testar DB
    log("Testando PostgreSQL...");
    try {
      const [{ total }] = await sql`SELECT count(*)::int as total FROM pluggy_items`;
      log(`PostgreSQL OK — ${total} items`);
    } catch (dbErr) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      log(`PostgreSQL ERRO: ${msg}`);
      console.error("SYNC DB ERROR:", msg);
      return Response.json({ error: `DB: ${msg}`, logs }, { status: 500 });
    }

    const savedItems = await sql<{ id: string; item_id: string; institution_name: string }[]>`
      SELECT id, item_id, institution_name FROM pluggy_items WHERE user_id = ${userId} ORDER BY created_at DESC
    `;

    if (savedItems.length === 0) {
      log("Nenhum item no banco");
      return Response.json({ message: "Nenhum banco conectado.", synced: false, itemsFound: 0, logs });
    }

    log(`${savedItems.length} item(s)`);
    const pluggy = createPluggyClient();
    const results = { itemsFound: savedItems.length, itemsSynced: 0, bankAccounts: 0, creditAccounts: 0, creditCards: 0, transactions: 0, investments: 0, loans: 0, bills: 0 };
    const itemErrors: Array<{ itemId: string; institution: string; error: string }> = [];

    // Processar items em paralelo
    const syncResults = await Promise.all(savedItems.map(async (dbItem) => {
      try {
        log(`Sync ${dbItem.institution_name}...`);
        const item = await pluggy.fetchItem(dbItem.item_id);
        log(`  Status: ${item.status}, connector: ${item.connector.name}`);

        // Usar nome real do conector. Se for "MeuPluggy" (sandbox), inferir de TODAS as contas
        let institutionName = item.connector.name;
        if (institutionName === "MeuPluggy") {
          const { results: accts } = await pluggy.fetchAccounts(dbItem.item_id);
          // Combinar todos os nomes de contas para buscar keywords
          const allNames = accts.map((a) => a.name?.toLowerCase() || "").join(" ");
          log(`  MeuPluggy — nomes das contas: ${allNames}`);
          if (allNames.includes("nubank") || allNames.includes("nu pagamento")) institutionName = "Nubank";
          else if (allNames.includes("inter")) institutionName = "Banco Inter";
          else if (allNames.includes("caixa") || allNames.includes("cef") || allNames.includes("sim visa")) institutionName = "Caixa Econômica Federal";
          else if (allNames.includes("bradesco")) institutionName = "Bradesco";
          else if (allNames.includes("itau") || allNames.includes("itaú")) institutionName = "Itaú";
          else if (allNames.includes("santander")) institutionName = "Santander";
          else if (allNames.includes("c6")) institutionName = "C6 Bank";
          log(`  MeuPluggy → inferido como: ${institutionName}`);
        }

        await sql`UPDATE pluggy_items SET status = ${item.status}, institution_name = ${institutionName} WHERE id = ${dbItem.id}::uuid`;

        const acct = await syncAccounts(pluggy, dbItem, institutionName, userId, log);
        const [txCount, invCount, loanCount, billCount] = await Promise.all([
          syncTransactions(pluggy, dbItem, userId, log),
          syncInvestments(pluggy, dbItem, userId, log),
          syncLoans(pluggy, dbItem, institutionName, userId, log),
          syncBills(pluggy, dbItem, institutionName, userId, log),
        ]);

        log(`  OK: ${acct.bankAccounts}bank ${acct.creditAccounts}credit ${txCount}tx`);
        return { ok: true as const, ...acct, transactions: txCount, investments: invCount, loans: loanCount, bills: billCount };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`  ERRO ${dbItem.institution_name}: ${msg}`);
        console.error(`SYNC ITEM ERROR [${dbItem.item_id}]:`, msg);
        itemErrors.push({ itemId: dbItem.item_id, institution: dbItem.institution_name, error: msg });
        return { ok: false as const };
      }
    }));

    for (const r of syncResults) {
      if (r.ok) {
        results.itemsSynced++;
        results.bankAccounts += r.bankAccounts;
        results.creditAccounts += r.creditAccounts;
        results.creditCards += r.creditCards;
        results.transactions += r.transactions;
        results.investments += r.investments;
        results.loans += r.loans;
        results.bills += r.bills;
      }
    }

    log(`Finalizado: ${results.itemsSynced}/${results.itemsFound}`);

    // Atualizar cache do dashboard — recalcular TUDO dos dados frescos
    log("Atualizando cache...");
    try {
      const [balRow, crRow, invRow, bnkRow] = await Promise.all([
        sql`SELECT COALESCE(SUM(balance),0)::float AS v FROM accounts WHERE user_id = ${userId} AND type NOT IN ('CREDIT','CREDIT_CARD')`,
        sql`SELECT COALESCE(SUM(ABS(balance)),0)::float AS used, COALESCE(SUM(COALESCE(credit_limit,0)),0)::float AS lim FROM accounts WHERE user_id = ${userId} AND type IN ('CREDIT','CREDIT_CARD')`,
        sql`SELECT COALESCE(SUM(balance),0)::float AS v FROM investments WHERE user_id = ${userId}`,
        sql`SELECT COUNT(*)::int AS v FROM pluggy_items WHERE user_id = ${userId}`,
      ]);
      const tb = Number(balRow[0]?.v) || 0;
      const tcu = Number(crRow[0]?.used) || 0;
      const tcl = Number(crRow[0]?.lim) || 0;
      const ti = Number(invRow[0]?.v) || 0;
      const cb = Number(bnkRow[0]?.v) || 0;
      const cacheData = { totalBalance: tb, totalCreditUsed: tcu, totalCreditLimit: tcl, totalInvested: ti, netBalance: tb + ti - tcu, connectedBanks: cb };
      log(`Cache calculado: bal=${tb} cr=${tcu}/${tcl} inv=${ti}`);

      // Tentar com updated_at primeiro, fallback para sem timestamp
      try {
        await sql`INSERT INTO dashboard_cache (user_id, data, updated_at) VALUES (${userId}, ${JSON.stringify(cacheData)}::jsonb, NOW()) ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`;
      } catch {
        // Se updated_at não existir, tentar só data
        await sql`INSERT INTO dashboard_cache (user_id, data) VALUES (${userId}, ${JSON.stringify(cacheData)}::jsonb) ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data`;
      }
      log("Cache salvo OK");
    } catch (cacheErr) {
      log(`Cache ERRO: ${cacheErr instanceof Error ? cacheErr.message : String(cacheErr)}`);
    }

    return Response.json({
      message: `${results.itemsSynced} de ${results.itemsFound} bancos sincronizados.`,
      synced: results.itemsSynced > 0, results,
      itemErrors: itemErrors.length > 0 ? itemErrors : undefined, logs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("SYNC ERROR DETAILS:", JSON.stringify({ message, stack }));
    log(`ERRO FATAL: ${message}`);
    return Response.json({ error: message, stack, logs }, { status: 500 });
  }
}

// --- Helper functions ---

async function syncAccounts(pluggy: Pluggy, dbItem: { id: string; item_id: string }, institutionName: string, userId: string, log: LogFn) {
  let bankAccounts = 0, creditAccounts = 0, creditCards = 0;
  const { results: accounts } = await pluggy.fetchAccounts(dbItem.item_id);
  log(`  ${accounts.length} contas`);

  for (const account of accounts) {
    try {
      const isCreditAccount = account.type === "CREDIT";
      const [upserted] = await sql`
        INSERT INTO accounts (item_id, pluggy_account_id, name, type, balance, credit_limit, currency, user_id, updated_at)
        VALUES (${dbItem.id}::uuid, ${account.id}, ${account.name}, ${account.subtype || account.type},
                ${account.balance}, ${account.creditData?.creditLimit || 0}, ${account.currencyCode}, ${userId}, now())
        ON CONFLICT (pluggy_account_id) DO UPDATE SET
          name = EXCLUDED.name, type = EXCLUDED.type, balance = EXCLUDED.balance,
          credit_limit = EXCLUDED.credit_limit, currency = EXCLUDED.currency, user_id = EXCLUDED.user_id, updated_at = now()
        RETURNING id`;

      if (isCreditAccount) creditAccounts++; else bankAccounts++;

      if (isCreditAccount && upserted) {
        const cd = account.creditData;
        await sql`
          INSERT INTO credit_cards (account_id, name, last4, balance, credit_limit, available_limit, updated_at)
          VALUES (${upserted.id}::uuid, ${`${institutionName} ${cd?.brand || ""}`.trim()},
                  ${account.number?.slice(-4) || "****"}, ${Math.abs(account.balance)},
                  ${cd?.creditLimit || 0}, ${cd?.availableCreditLimit || 0}, now())
          ON CONFLICT (account_id) DO UPDATE SET
            name = EXCLUDED.name, last4 = EXCLUDED.last4, balance = EXCLUDED.balance,
            credit_limit = EXCLUDED.credit_limit, available_limit = EXCLUDED.available_limit, updated_at = now()`;
        creditCards++;
      }
    } catch (e) { log(`  Erro conta ${account.id}: ${e instanceof Error ? e.message : String(e)}`); }
  }
  return { bankAccounts, creditAccounts, creditCards };
}

async function syncTransactions(pluggy: Pluggy, dbItem: { id: string; item_id: string }, userId: string, log: LogFn) {
  let count = 0;
  const dbAccounts = await sql<{ id: string; pluggy_account_id: string; type: string }[]>`
    SELECT id, pluggy_account_id, type FROM accounts WHERE item_id = ${dbItem.id}::uuid`;
  if (!dbAccounts.length) return 0;

  const from = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

  for (const acct of dbAccounts) {
    try {
      const txs = await pluggy.fetchAllTransactions(acct.pluggy_account_id, { from });
      log(`  ${txs.length} tx (${acct.type})`);
      for (const tx of txs as PluggyTransaction[]) {
        const txDate = typeof tx.date === "string" ? tx.date : new Date(tx.date).toISOString().split("T")[0];
        await sql`INSERT INTO transactions (account_id, pluggy_transaction_id, description, amount, date, category, type, user_id)
          VALUES (${acct.id}::uuid, ${tx.id}, ${tx.description}, ${tx.amount}, ${txDate}, ${tx.category || null}, ${tx.type}, ${userId})
          ON CONFLICT (pluggy_transaction_id) DO UPDATE SET description = EXCLUDED.description, amount = EXCLUDED.amount, date = EXCLUDED.date, category = EXCLUDED.category, type = EXCLUDED.type, user_id = EXCLUDED.user_id`;
      }
      count += txs.length;
    } catch (e) { log(`  Erro tx: ${e instanceof Error ? e.message : String(e)}`); }
  }
  return count;
}

async function syncInvestments(pluggy: Pluggy, dbItem: { id: string; item_id: string }, userId: string, log: LogFn) {
  let count = 0;
  try {
    const { results: invs } = await pluggy.fetchInvestments(dbItem.item_id);
    log(`  ${invs.length} inv`);
    for (const inv of invs) {
      await sql`INSERT INTO investments (item_id, pluggy_investment_id, name, type, balance, quantity, value, user_id, updated_at)
        VALUES (${dbItem.id}::uuid, ${inv.id}, ${inv.name}, ${inv.type}, ${inv.balance}, ${inv.quantity || 0}, ${inv.value || 0}, ${userId}, now())
        ON CONFLICT (pluggy_investment_id) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, balance = EXCLUDED.balance, quantity = EXCLUDED.quantity, value = EXCLUDED.value, user_id = EXCLUDED.user_id, updated_at = now()`;
      count++;
    }
  } catch (e) { log(`  Inv indisponível: ${e instanceof Error ? e.message : String(e)}`); }
  return count;
}

async function syncLoans(pluggy: Pluggy, dbItem: { id: string; item_id: string }, institutionName: string, userId: string, log: LogFn) {
  let count = 0;
  try {
    const { results: loans } = await pluggy.fetchLoans(dbItem.item_id);
    log(`  ${loans.length} loans`);
    for (const loan of loans) {
      await sql`INSERT INTO loans (item_id, pluggy_loan_id, institution_name, name, total_amount, installment_amount, total_installments, paid_installments, outstanding_balance, interest_rate, updated_at)
        VALUES (${dbItem.id}::uuid, ${loan.id}, ${institutionName}, ${loan.productName}, ${loan.contractAmount || 0}, ${0},
                ${loan.installments?.totalNumberOfInstallments || 0}, ${loan.installments?.paidInstallments || 0},
                ${loan.payments?.contractOutstandingBalance || 0}, ${loan.CET || 0}, now())
        ON CONFLICT (pluggy_loan_id) DO UPDATE SET institution_name = EXCLUDED.institution_name, name = EXCLUDED.name,
          total_amount = EXCLUDED.total_amount, total_installments = EXCLUDED.total_installments,
          paid_installments = EXCLUDED.paid_installments, outstanding_balance = EXCLUDED.outstanding_balance, interest_rate = EXCLUDED.interest_rate, updated_at = now()`;
      count++;
    }
  } catch (e) { log(`  Loans indisponível: ${e instanceof Error ? e.message : String(e)}`); }
  return count;
}

async function syncBills(pluggy: Pluggy, dbItem: { id: string; item_id: string }, institutionName: string, userId: string, log: LogFn) {
  let count = 0;
  try {
    // @ts-expect-error — fetchBills pode não existir em todas as versões do SDK
    if (typeof pluggy.fetchBills !== "function") { log("  Bills: método não disponível"); return 0; }
    // @ts-expect-error — fetchBills não tipado no SDK atual
    const { results: bills } = await pluggy.fetchBills(dbItem.item_id);
    log(`  ${bills.length} bills`);
    for (const bill of bills) {
      await sql`INSERT INTO bills (user_id, item_id, pluggy_bill_id, institution_name, description, amount, due_date, status, updated_at)
        VALUES (${userId}, ${dbItem.id}::uuid, ${bill.id}, ${institutionName}, ${bill.description || bill.name || "Boleto"}, ${bill.amount || 0}, ${bill.dueDate || null}, ${bill.status || "PENDING"}, now())
        ON CONFLICT (pluggy_bill_id) DO UPDATE SET description = EXCLUDED.description, amount = EXCLUDED.amount, due_date = EXCLUDED.due_date, status = EXCLUDED.status, updated_at = now()`;
      count++;
    }
  } catch (e) { log(`  Bills indisponível: ${e instanceof Error ? e.message : String(e)}`); }
  return count;
}

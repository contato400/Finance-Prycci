import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPluggyClient } from "@/lib/pluggy/client";
import { supabaseSelect, supabaseUpsert, supabaseUpdate } from "@/lib/supabase/rest";
import type { Transaction as PluggyTransaction } from "pluggy-sdk";

type LogFn = (msg: string) => void;
type Pluggy = ReturnType<typeof createPluggyClient>;

// Sincroniza dados do Pluggy com o Supabase via REST API.
// Busca items salvos no banco → para cada, busca dados via SDK → salva via REST.
export async function POST() {
  const logs: string[] = [];
  const log: LogFn = (msg) => { logs.push(`[${new Date().toISOString()}] ${msg}`); };

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    if (!(process.env.PLUGGY_CLIENT_ID || "").trim() || !(process.env.PLUGGY_CLIENT_SECRET || "").trim()) {
      return NextResponse.json({ error: "PLUGGY_CLIENT_ID/SECRET não configurados", logs }, { status: 500 });
    }
    if (!(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim() || !(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()) {
      return NextResponse.json({ error: "Variáveis do Supabase não configuradas", logs }, { status: 500 });
    }

    log("Iniciando sincronização...");

    // 1. Testar Supabase
    log("Testando Supabase REST API...");
    const { error: dbTestError } = await supabaseSelect("pluggy_items", { select: "id", limit: 1 });
    if (dbTestError) {
      log(`Supabase ERRO: ${dbTestError.message} (code: ${dbTestError.code})`);
      return NextResponse.json({
        error: `Supabase: ${dbTestError.message}. Rode o SQL no SQL Editor.`,
        code: dbTestError.code,
        logs,
      }, { status: 500 });
    }
    log("Supabase OK");

    // 2. Buscar items do banco
    const { data: savedItems, error: fetchErr } = await supabaseSelect<{
      id: string; item_id: string; institution_name: string;
    }>("pluggy_items", { select: "id,item_id,institution_name", order: "created_at.desc" });

    if (fetchErr) {
      log(`Erro ao buscar items: ${fetchErr.message}`);
      return NextResponse.json({ error: fetchErr.message, logs }, { status: 500 });
    }

    if (!savedItems || savedItems.length === 0) {
      log("Nenhum item no banco");
      return NextResponse.json({
        message: "Nenhum banco conectado. Use 'Adicionar Banco' no Dashboard.",
        synced: false, itemsFound: 0, logs,
      });
    }

    log(`${savedItems.length} item(s) no banco`);

    // 3. Sincronizar cada item
    const pluggy = createPluggyClient();
    const results = { itemsFound: savedItems.length, itemsSynced: 0, accounts: 0, transactions: 0, creditCards: 0, investments: 0, loans: 0 };
    const itemErrors: Array<{ itemId: string; institution: string; error: string }> = [];

    for (const dbItem of savedItems) {
      try {
        log(`Sincronizando ${dbItem.institution_name} (${dbItem.item_id})...`);
        const item = await pluggy.fetchItem(dbItem.item_id);
        log(`  Status: ${item.status}`);

        await supabaseUpdate("pluggy_items",
          { status: item.status, institution_name: item.connector.name },
          `id=eq.${dbItem.id}`
        );

        const acct = await syncAccounts(pluggy, dbItem, item.connector.name, log);
        results.accounts += acct.accounts;
        results.creditCards += acct.creditCards;
        results.transactions += await syncTransactions(pluggy, dbItem, log);
        results.investments += await syncInvestments(pluggy, dbItem, log);
        results.loans += await syncLoans(pluggy, dbItem, item.connector.name, log);

        results.itemsSynced++;
        log(`  ${dbItem.institution_name} OK`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`  ERRO ${dbItem.institution_name}: ${msg}`);
        itemErrors.push({ itemId: dbItem.item_id, institution: dbItem.institution_name, error: msg });
      }
    }

    log(`Finalizado: ${results.itemsSynced}/${results.itemsFound}`);

    return NextResponse.json({
      message: `${results.itemsSynced} de ${results.itemsFound} bancos sincronizados.`,
      synced: results.itemsSynced > 0,
      results,
      itemErrors: itemErrors.length > 0 ? itemErrors : undefined,
      logs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`ERRO FATAL: ${message}`);
    return NextResponse.json({ error: message, logs }, { status: 500 });
  }
}

// --- Sync helpers ---

async function syncAccounts(
  pluggy: Pluggy,
  dbItem: { id: string; item_id: string },
  institutionName: string, log: LogFn
) {
  let accountCount = 0, creditCardCount = 0;

  const { results: accounts } = await pluggy.fetchAccounts(dbItem.item_id);
  log(`  ${accounts.length} contas`);

  for (const account of accounts) {
    const { data, error } = await supabaseUpsert("accounts", {
      item_id: dbItem.id,
      pluggy_account_id: account.id,
      name: account.name,
      type: account.subtype || account.type,
      balance: account.balance,
      credit_limit: account.creditData?.creditLimit || 0,
      currency: account.currencyCode,
      updated_at: new Date().toISOString(),
    }, "pluggy_account_id");

    if (error) { log(`  Erro conta ${account.id}: ${error.message}`); continue; }
    accountCount++;

    const upserted = data?.[0];
    if (account.type === "CREDIT" && account.creditData && upserted) {
      const cd = account.creditData;
      const { error: cardErr } = await supabaseUpsert("credit_cards", {
        account_id: upserted.id,
        name: `${institutionName} ${cd.brand || ""}`.trim(),
        last4: account.number?.slice(-4) || "****",
        balance: Math.abs(account.balance),
        credit_limit: cd.creditLimit || 0,
        available_limit: cd.availableCreditLimit || 0,
        updated_at: new Date().toISOString(),
      }, "account_id");
      if (cardErr) log(`  Erro cartão: ${cardErr.message}`);
      else creditCardCount++;
    }
  }

  return { accounts: accountCount, creditCards: creditCardCount };
}

async function syncTransactions(
  pluggy: Pluggy,
  dbItem: { id: string; item_id: string }, log: LogFn
) {
  let count = 0;

  const { data: dbAccounts } = await supabaseSelect<{ id: string; pluggy_account_id: string }>(
    "accounts", { select: "id,pluggy_account_id", filter: `item_id=eq.${dbItem.id}` }
  );

  if (!dbAccounts?.length) return 0;

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 90);
  const from = fromDate.toISOString().split("T")[0];

  for (const acct of dbAccounts) {
    try {
      const txs = await pluggy.fetchAllTransactions(acct.pluggy_account_id, { from });
      log(`  ${txs.length} transações (${acct.pluggy_account_id.substring(0, 8)}...)`);

      const batch = txs.map((tx: PluggyTransaction) => ({
        account_id: acct.id,
        pluggy_transaction_id: tx.id,
        description: tx.description,
        amount: tx.amount,
        date: typeof tx.date === "string" ? tx.date : new Date(tx.date).toISOString().split("T")[0],
        category: tx.category || null,
        type: tx.type,
      }));

      for (let i = 0; i < batch.length; i += 500) {
        const { error } = await supabaseUpsert("transactions", batch.slice(i, i + 500), "pluggy_transaction_id");
        if (error) log(`  Erro tx chunk ${i}: ${error.message}`);
      }
      count += batch.length;
    } catch (e) {
      log(`  Erro tx ${acct.pluggy_account_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return count;
}

async function syncInvestments(pluggy: Pluggy, dbItem: { id: string; item_id: string }, log: LogFn) {
  let count = 0;
  try {
    const { results: invs } = await pluggy.fetchInvestments(dbItem.item_id);
    log(`  ${invs.length} investimentos`);
    for (const inv of invs) {
      const { error } = await supabaseUpsert("investments", {
        item_id: dbItem.id, pluggy_investment_id: inv.id,
        name: inv.name, type: inv.type, balance: inv.balance,
        quantity: inv.quantity || 0, value: inv.value || 0,
        updated_at: new Date().toISOString(),
      }, "pluggy_investment_id");
      if (error) log(`  Erro investimento: ${error.message}`);
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
      const { error } = await supabaseUpsert("loans", {
        item_id: dbItem.id, pluggy_loan_id: loan.id,
        institution_name: institutionName, name: loan.productName,
        total_amount: loan.contractAmount || 0, installment_amount: 0,
        total_installments: loan.installments?.totalNumberOfInstallments || 0,
        paid_installments: loan.installments?.paidInstallments || 0,
        outstanding_balance: loan.payments?.contractOutstandingBalance || 0,
        interest_rate: loan.CET || 0,
        updated_at: new Date().toISOString(),
      }, "pluggy_loan_id");
      if (error) log(`  Erro empréstimo: ${error.message}`);
      count++;
    }
  } catch (e) { log(`  Empréstimos indisponíveis: ${e instanceof Error ? e.message : String(e)}`); }
  return count;
}

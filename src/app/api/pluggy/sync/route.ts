import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createPluggyClient,
  getPluggyApiKey,
  fetchAllItemsFromApi,
} from "@/lib/pluggy/client";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Account as PluggyAccount, Transaction as PluggyTransaction } from "pluggy-sdk";

type LogFn = (msg: string) => void;
type Pluggy = ReturnType<typeof createPluggyClient>;
type Supabase = ReturnType<typeof createSupabaseServer>;

// Sincroniza todos os dados do Pluggy com o Supabase
export async function POST() {
  const logs: string[] = [];
  const log: LogFn = (msg) => { logs.push(`[${new Date().toISOString()}] ${msg}`); };

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Validar env vars
    if (!process.env.PLUGGY_CLIENT_ID || !process.env.PLUGGY_CLIENT_SECRET) {
      return NextResponse.json({
        error: "PLUGGY_CLIENT_ID ou PLUGGY_CLIENT_SECRET não configurados no .env.local",
        logs,
      }, { status: 500 });
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({
        error: "Variáveis do Supabase não configuradas no .env.local",
        logs,
      }, { status: 500 });
    }

    log("Iniciando sincronização...");

    const pluggy = createPluggyClient();
    const supabase = createSupabaseServer();

    // 1. Testar Supabase
    log("Testando Supabase...");
    const { error: dbError } = await supabase.from("pluggy_items").select("id").limit(1);
    if (dbError) {
      log(`Supabase ERRO: ${dbError.message} (code: ${dbError.code})`);
      return NextResponse.json({
        error: `Supabase: ${dbError.message}. Verifique se as tabelas foram criadas (rode o SQL no SQL Editor).`,
        code: dbError.code,
        logs,
      }, { status: 500 });
    }
    log("Supabase OK");

    // 2. Autenticar na Pluggy
    log("Autenticando na Pluggy API...");
    let apiKey: string;
    try {
      apiKey = await getPluggyApiKey();
      log(`Pluggy auth OK (apiKey: ${apiKey.substring(0, 15)}...)`);
    } catch (authErr) {
      const msg = authErr instanceof Error ? authErr.message : String(authErr);
      log(`Pluggy auth ERRO: ${msg}`);
      return NextResponse.json({ error: msg, logs }, { status: 500 });
    }

    // 3. Descobrir items — tenta API primeiro, fallback para items salvos no DB
    log("Buscando items...");

    const apiResult = await fetchAllItemsFromApi(apiKey);
    log(`GET /items: ${apiResult.method === "api" ? `${apiResult.items.length} items` : `falhou (${apiResult.error})`}`);

    // Items a sincronizar: combinar API + banco
    const itemIdsToSync = new Map<string, string>(); // item_id → institution_name

    // Items da API (se disponível)
    for (const item of apiResult.items) {
      itemIdsToSync.set(item.id, item.connector.name);
    }

    // Items já salvos no banco (conectados via widget anteriormente)
    const { data: savedItems } = await supabase.from("pluggy_items").select("item_id, institution_name");
    for (const saved of savedItems || []) {
      if (!itemIdsToSync.has(saved.item_id)) {
        itemIdsToSync.set(saved.item_id, saved.institution_name);
      }
    }

    log(`Total de items para sincronizar: ${itemIdsToSync.size} (${apiResult.items.length} da API, ${savedItems?.length || 0} do DB)`);

    if (itemIdsToSync.size === 0) {
      return NextResponse.json({
        message: "Nenhum item encontrado. Adicione um banco pelo botão 'Adicionar Banco' no Dashboard.",
        synced: false,
        itemsFound: 0,
        logs,
      });
    }

    // 4. Para cada item: validar com o SDK, upsert no DB, sincronizar dados
    const results = {
      itemsFound: itemIdsToSync.size,
      itemsSynced: 0,
      accounts: 0,
      transactions: 0,
      creditCards: 0,
      investments: 0,
      loans: 0,
    };
    const itemErrors: Array<{ itemId: string; error: string }> = [];

    for (const [itemId, institutionName] of Array.from(itemIdsToSync.entries())) {
      try {
        // Validar item via SDK (busca dados atualizados)
        log(`Validando item ${itemId} (${institutionName})...`);
        const item = await pluggy.fetchItem(itemId);
        log(`  Status: ${item.status}, Connector: ${item.connector.name}`);

        // Upsert no Supabase
        const { data: dbItem, error: upsertErr } = await supabase
          .from("pluggy_items")
          .upsert(
            {
              item_id: itemId,
              institution_name: item.connector.name,
              status: item.status,
            },
            { onConflict: "item_id" }
          )
          .select("id, item_id, institution_name")
          .single();

        if (upsertErr || !dbItem) {
          const msg = upsertErr?.message || "upsert retornou null";
          log(`  Erro upsert pluggy_items: ${msg}`);
          itemErrors.push({ itemId, error: msg });
          continue;
        }

        // Sincronizar contas e cartões
        const acctResult = await syncAccounts(pluggy, supabase, dbItem, item.connector.name, log);
        results.accounts += acctResult.accounts;
        results.creditCards += acctResult.creditCards;

        // Sincronizar transações
        results.transactions += await syncTransactions(pluggy, supabase, dbItem, log);

        // Sincronizar investimentos
        results.investments += await syncInvestments(pluggy, supabase, dbItem, log);

        // Sincronizar empréstimos
        results.loans += await syncLoans(pluggy, supabase, dbItem, item.connector.name, log);

        results.itemsSynced++;
        log(`Item ${itemId} sincronizado com sucesso`);
      } catch (itemErr) {
        const msg = itemErr instanceof Error ? itemErr.message : String(itemErr);
        log(`ERRO item ${itemId}: ${msg}`);
        itemErrors.push({ itemId, error: msg });
      }
    }

    log(`Sincronização finalizada: ${results.itemsSynced}/${results.itemsFound} items OK`);

    return NextResponse.json({
      message: `${results.itemsSynced} de ${results.itemsFound} bancos sincronizados.`,
      synced: results.itemsSynced > 0,
      results,
      itemErrors: itemErrors.length > 0 ? itemErrors : undefined,
      logs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    log(`ERRO FATAL: ${message}`);
    return NextResponse.json({
      error: message,
      stack: process.env.NODE_ENV === "development" ? stack : undefined,
      logs,
    }, { status: 500 });
  }
}

// --- Funções de sincronização por tipo de dado ---

async function syncAccounts(
  pluggy: Pluggy, supabase: Supabase,
  dbItem: { id: string; item_id: string },
  institutionName: string, log: LogFn
) {
  let accountCount = 0;
  let creditCardCount = 0;

  log(`  Buscando contas...`);
  const { results: accounts } = await pluggy.fetchAccounts(dbItem.item_id);
  log(`  ${accounts.length} contas encontradas`);

  for (const account of accounts) {
    const { data: upserted, error } = await supabase
      .from("accounts")
      .upsert({
        item_id: dbItem.id,
        pluggy_account_id: account.id,
        name: account.name,
        type: account.subtype || account.type,
        balance: account.balance,
        credit_limit: account.creditData?.creditLimit || 0,
        currency: account.currencyCode,
        updated_at: new Date().toISOString(),
      }, { onConflict: "pluggy_account_id" })
      .select()
      .single();

    if (error) { log(`  Erro conta ${account.id}: ${error.message}`); continue; }
    accountCount++;

    if (account.type === "CREDIT" && account.creditData && upserted) {
      await syncCreditCard(supabase, upserted.id, account, institutionName, log);
      creditCardCount++;
    }
  }

  log(`  Contas: ${accountCount}, Cartões: ${creditCardCount}`);
  return { accounts: accountCount, creditCards: creditCardCount };
}

async function syncCreditCard(
  supabase: Supabase, dbAccountId: string,
  account: PluggyAccount, institutionName: string, log: LogFn
) {
  const cd = account.creditData!;
  const last4 = account.number?.slice(-4) || "****";

  const { error } = await supabase
    .from("credit_cards")
    .upsert({
      account_id: dbAccountId,
      name: `${institutionName} ${cd.brand || ""}`.trim(),
      last4,
      balance: Math.abs(account.balance),
      credit_limit: cd.creditLimit || 0,
      available_limit: cd.availableCreditLimit || 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: "account_id" });

  if (error) log(`  Erro cartão ${dbAccountId}: ${error.message}`);
}

async function syncTransactions(
  pluggy: Pluggy, supabase: Supabase,
  dbItem: { id: string; item_id: string }, log: LogFn
) {
  let count = 0;

  const { data: dbAccounts } = await supabase
    .from("accounts")
    .select("id, pluggy_account_id")
    .eq("item_id", dbItem.id);

  if (!dbAccounts?.length) { log("  Sem contas para buscar transações"); return 0; }

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 90);
  const from = fromDate.toISOString().split("T")[0];

  for (const acct of dbAccounts) {
    try {
      log(`  Transações conta ${acct.pluggy_account_id}...`);
      const txs = await pluggy.fetchAllTransactions(acct.pluggy_account_id, { from });
      log(`  ${txs.length} transações`);

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
        const { error } = await supabase
          .from("transactions")
          .upsert(batch.slice(i, i + 500), { onConflict: "pluggy_transaction_id" });
        if (error) log(`  Erro transações chunk ${i}: ${error.message}`);
      }
      count += batch.length;
    } catch (e) {
      log(`  Erro transações ${acct.pluggy_account_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return count;
}

async function syncInvestments(
  pluggy: Pluggy, supabase: Supabase,
  dbItem: { id: string; item_id: string }, log: LogFn
) {
  let count = 0;
  try {
    log(`  Buscando investimentos...`);
    const { results: invs } = await pluggy.fetchInvestments(dbItem.item_id);
    log(`  ${invs.length} investimentos`);

    for (const inv of invs) {
      const { error } = await supabase
        .from("investments")
        .upsert({
          item_id: dbItem.id,
          pluggy_investment_id: inv.id,
          name: inv.name,
          type: inv.type,
          balance: inv.balance,
          quantity: inv.quantity || 0,
          value: inv.value || 0,
          updated_at: new Date().toISOString(),
        }, { onConflict: "pluggy_investment_id" });
      if (error) log(`  Erro investimento ${inv.id}: ${error.message}`);
      count++;
    }
  } catch (e) {
    log(`  Investimentos indisponíveis: ${e instanceof Error ? e.message : String(e)}`);
  }
  return count;
}

async function syncLoans(
  pluggy: Pluggy, supabase: Supabase,
  dbItem: { id: string; item_id: string },
  institutionName: string, log: LogFn
) {
  let count = 0;
  try {
    log(`  Buscando empréstimos...`);
    const { results: loans } = await pluggy.fetchLoans(dbItem.item_id);
    log(`  ${loans.length} empréstimos`);

    for (const loan of loans) {
      const { error } = await supabase
        .from("loans")
        .upsert({
          item_id: dbItem.id,
          pluggy_loan_id: loan.id,
          institution_name: institutionName,
          name: loan.productName,
          total_amount: loan.contractAmount || 0,
          installment_amount: 0,
          total_installments: loan.installments?.totalNumberOfInstallments || 0,
          paid_installments: loan.installments?.paidInstallments || 0,
          outstanding_balance: loan.payments?.contractOutstandingBalance || 0,
          interest_rate: loan.CET || 0,
          updated_at: new Date().toISOString(),
        }, { onConflict: "pluggy_loan_id" });
      if (error) log(`  Erro empréstimo ${loan.id}: ${error.message}`);
      count++;
    }
  } catch (e) {
    log(`  Empréstimos indisponíveis: ${e instanceof Error ? e.message : String(e)}`);
  }
  return count;
}

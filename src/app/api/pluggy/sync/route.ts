import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPluggyClient } from "@/lib/pluggy/client";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Transaction as PluggyTransaction } from "pluggy-sdk";

type LogFn = (msg: string) => void;
type Pluggy = ReturnType<typeof createPluggyClient>;
type Supabase = ReturnType<typeof createSupabaseServer>;

// Sincroniza todos os dados do Pluggy com o Supabase.
// Fluxo: busca items salvos no banco (adicionados via PluggyWidget) →
// para cada item, busca dados via SDK → salva no Supabase.
export async function POST() {
  const logs: string[] = [];
  const log: LogFn = (msg) => { logs.push(`[${new Date().toISOString()}] ${msg}`); };

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Validar env vars
    const pluggyId = (process.env.PLUGGY_CLIENT_ID || "").trim();
    const pluggySecret = (process.env.PLUGGY_CLIENT_SECRET || "").trim();
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

    if (!pluggyId || !pluggySecret) {
      return NextResponse.json({
        error: "PLUGGY_CLIENT_ID ou PLUGGY_CLIENT_SECRET não configurados",
        logs,
      }, { status: 500 });
    }
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        error: "Variáveis do Supabase não configuradas",
        logs,
      }, { status: 500 });
    }

    log("Iniciando sincronização...");
    log(`Supabase URL: ${supabaseUrl}`);
    log(`Pluggy Client ID: ${pluggyId.substring(0, 8)}...`);

    const supabase = createSupabaseServer();

    // 1. Testar conexão Supabase
    log("Testando Supabase...");
    const { error: dbTestError } = await supabase.from("pluggy_items").select("id").limit(1);
    if (dbTestError) {
      log(`Supabase ERRO: ${dbTestError.message} (code: ${dbTestError.code}, hint: ${dbTestError.hint || "—"})`);
      return NextResponse.json({
        error: `Supabase: ${dbTestError.message}. Rode o SQL de criação das tabelas no SQL Editor.`,
        code: dbTestError.code,
        hint: dbTestError.hint,
        logs,
      }, { status: 500 });
    }
    log("Supabase OK");

    // 2. Buscar items salvos no banco (adicionados via PluggyWidget / POST /api/pluggy/items)
    const { data: savedItems, error: fetchItemsError } = await supabase
      .from("pluggy_items")
      .select("id, item_id, institution_name")
      .order("created_at", { ascending: false });

    if (fetchItemsError) {
      log(`Erro ao buscar items do DB: ${fetchItemsError.message}`);
      return NextResponse.json({
        error: `Erro ao buscar items: ${fetchItemsError.message}`,
        logs,
      }, { status: 500 });
    }

    if (!savedItems || savedItems.length === 0) {
      log("Nenhum item no banco. Usuário precisa adicionar banco via widget.");
      return NextResponse.json({
        message: "Nenhum banco conectado. Use o botão 'Adicionar Banco' no Dashboard para conectar.",
        synced: false,
        itemsFound: 0,
        logs,
      });
    }

    log(`${savedItems.length} item(s) encontrado(s) no banco`);

    // 3. Criar client Pluggy (auth é feita automaticamente pelo SDK)
    const pluggy = createPluggyClient();

    // 4. Sincronizar cada item
    const results = {
      itemsFound: savedItems.length,
      itemsSynced: 0,
      accounts: 0,
      transactions: 0,
      creditCards: 0,
      investments: 0,
      loans: 0,
    };
    const itemErrors: Array<{ itemId: string; institution: string; error: string }> = [];

    for (const dbItem of savedItems) {
      try {
        log(`Sincronizando ${dbItem.institution_name} (${dbItem.item_id})...`);

        // Buscar item atualizado via SDK (valida que ainda existe na Pluggy)
        const item = await pluggy.fetchItem(dbItem.item_id);
        log(`  Status: ${item.status}`);

        // Atualizar status no banco
        await supabase
          .from("pluggy_items")
          .update({ status: item.status, institution_name: item.connector.name })
          .eq("id", dbItem.id);

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
        log(`  ${dbItem.institution_name} OK`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`  ERRO ${dbItem.institution_name}: ${msg}`);
        itemErrors.push({ itemId: dbItem.item_id, institution: dbItem.institution_name, error: msg });
      }
    }

    log(`Finalizado: ${results.itemsSynced}/${results.itemsFound} bancos sincronizados`);

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

// --- Funções de sincronização ---

async function syncAccounts(
  pluggy: Pluggy, supabase: Supabase,
  dbItem: { id: string; item_id: string },
  institutionName: string, log: LogFn
) {
  let accountCount = 0;
  let creditCardCount = 0;

  const { results: accounts } = await pluggy.fetchAccounts(dbItem.item_id);
  log(`  ${accounts.length} contas`);

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
      const cd = account.creditData;
      const { error: cardErr } = await supabase
        .from("credit_cards")
        .upsert({
          account_id: upserted.id,
          name: `${institutionName} ${cd.brand || ""}`.trim(),
          last4: account.number?.slice(-4) || "****",
          balance: Math.abs(account.balance),
          credit_limit: cd.creditLimit || 0,
          available_limit: cd.availableCreditLimit || 0,
          updated_at: new Date().toISOString(),
        }, { onConflict: "account_id" });
      if (cardErr) log(`  Erro cartão: ${cardErr.message}`);
      else creditCardCount++;
    }
  }

  return { accounts: accountCount, creditCards: creditCardCount };
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

  if (!dbAccounts?.length) return 0;

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 90);
  const from = fromDate.toISOString().split("T")[0];

  for (const acct of dbAccounts) {
    try {
      const txs = await pluggy.fetchAllTransactions(acct.pluggy_account_id, { from });
      log(`  ${txs.length} transações (${acct.pluggy_account_id})`);

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
      log(`  Erro tx ${acct.pluggy_account_id}: ${e instanceof Error ? e.message : String(e)}`);
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
      if (error) log(`  Erro investimento: ${error.message}`);
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
      if (error) log(`  Erro empréstimo: ${error.message}`);
      count++;
    }
  } catch (e) {
    log(`  Empréstimos indisponíveis: ${e instanceof Error ? e.message : String(e)}`);
  }
  return count;
}

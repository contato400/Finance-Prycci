import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPluggyClient, fetchAllItems } from "@/lib/pluggy/client";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Account as PluggyAccount, Transaction as PluggyTransaction } from "pluggy-sdk";

// Sincroniza todos os dados do Pluggy com o Supabase
// 1. Busca todos os items na API Pluggy (GET /items)
// 2. Salva cada item no Supabase (upsert)
// 3. Sincroniza contas, transações, cartões, investimentos e empréstimos
export async function POST() {
  const logs: string[] = [];
  const log = (msg: string) => { logs.push(`[${new Date().toISOString()}] ${msg}`); };

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Validar variáveis de ambiente
    if (!process.env.PLUGGY_CLIENT_ID || !process.env.PLUGGY_CLIENT_SECRET) {
      return NextResponse.json({
        error: "PLUGGY_CLIENT_ID ou PLUGGY_CLIENT_SECRET não configurados",
        logs,
      }, { status: 500 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({
        error: "Variáveis do Supabase não configuradas",
        logs,
      }, { status: 500 });
    }

    log("Iniciando sincronização...");
    log(`PLUGGY_CLIENT_ID: ${process.env.PLUGGY_CLIENT_ID.substring(0, 8)}...`);
    log(`SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);

    const pluggy = createPluggyClient();
    const supabase = createSupabaseServer();

    // 1. Testar conexão com Supabase primeiro
    log("Testando conexão com Supabase...");
    const { error: supabaseTestError } = await supabase
      .from("pluggy_items")
      .select("id")
      .limit(1);

    if (supabaseTestError) {
      log(`Erro Supabase: ${supabaseTestError.message} (code: ${supabaseTestError.code})`);
      return NextResponse.json({
        error: `Erro ao conectar com Supabase: ${supabaseTestError.message}`,
        details: supabaseTestError,
        logs,
      }, { status: 500 });
    }
    log("Supabase OK");

    // 2. Buscar TODOS os items existentes na API Pluggy
    log("Buscando items na Pluggy API...");
    let pluggyItems;
    try {
      pluggyItems = await fetchAllItems();
      log(`Items encontrados na Pluggy: ${pluggyItems.length}`);
    } catch (authError) {
      const msg = authError instanceof Error ? authError.message : String(authError);
      log(`Erro ao buscar items Pluggy: ${msg}`);
      return NextResponse.json({
        error: `Erro na API Pluggy: ${msg}`,
        logs,
      }, { status: 500 });
    }

    if (pluggyItems.length === 0) {
      log("Nenhum item encontrado na Pluggy");
      return NextResponse.json({
        message: "Nenhum item encontrado na Pluggy. Adicione um banco primeiro.",
        synced: false,
        itemsFound: 0,
        logs,
      });
    }

    // 3. Salvar cada item no Supabase (upsert pelo item_id)
    log("Salvando items no Supabase...");
    const dbItems: Array<{ id: string; item_id: string; institution_name: string }> = [];

    for (const pluggyItem of pluggyItems) {
      log(`Upsert item: ${pluggyItem.id} (${pluggyItem.connector.name}) status=${pluggyItem.status}`);

      const { data: upserted, error: upsertError } = await supabase
        .from("pluggy_items")
        .upsert(
          {
            item_id: pluggyItem.id,
            institution_name: pluggyItem.connector.name,
            status: pluggyItem.status,
          },
          { onConflict: "item_id" }
        )
        .select("id, item_id, institution_name")
        .single();

      if (upsertError) {
        log(`Erro upsert pluggy_items: ${upsertError.message} (code: ${upsertError.code})`);
        continue;
      }

      if (upserted) {
        dbItems.push(upserted);
        log(`Item salvo: DB id=${upserted.id}`);
      }
    }

    // 4. Sincronizar dados de cada item
    const results = {
      itemsFound: pluggyItems.length,
      itemsSynced: 0,
      accounts: 0,
      transactions: 0,
      creditCards: 0,
      investments: 0,
      loans: 0,
    };
    const itemErrors: Array<{ itemId: string; error: string }> = [];

    for (const dbItem of dbItems) {
      try {
        log(`Sincronizando item ${dbItem.item_id} (${dbItem.institution_name})...`);

        // Sincronizar contas e cartões
        const accountsResult = await syncAccounts(pluggy, supabase, dbItem, dbItem.institution_name, log);
        results.accounts += accountsResult.accounts;
        results.creditCards += accountsResult.creditCards;

        // Sincronizar transações dos últimos 90 dias
        results.transactions += await syncTransactions(pluggy, supabase, dbItem, log);

        // Sincronizar investimentos
        results.investments += await syncInvestments(pluggy, supabase, dbItem, log);

        // Sincronizar empréstimos
        results.loans += await syncLoans(pluggy, supabase, dbItem, dbItem.institution_name, log);

        results.itemsSynced++;
        log(`Item ${dbItem.item_id} sincronizado com sucesso`);
      } catch (itemError) {
        const msg = itemError instanceof Error ? itemError.message : String(itemError);
        log(`ERRO item ${dbItem.item_id}: ${msg}`);
        itemErrors.push({ itemId: dbItem.item_id, error: msg });
      }
    }

    log(`Sincronização finalizada: ${results.itemsSynced}/${results.itemsFound} items`);

    return NextResponse.json({
      message: `Sincronização concluída: ${results.itemsFound} items encontrados, ${results.itemsSynced} sincronizados.`,
      synced: true,
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

// Sincroniza contas bancárias e cartões de crédito
async function syncAccounts(
  pluggy: ReturnType<typeof createPluggyClient>,
  supabase: ReturnType<typeof createSupabaseServer>,
  dbItem: { id: string; item_id: string },
  institutionName: string,
  log: (msg: string) => void
) {
  let accountCount = 0;
  let creditCardCount = 0;

  log(`  Buscando contas do item ${dbItem.item_id}...`);
  const { results: accounts } = await pluggy.fetchAccounts(dbItem.item_id);
  log(`  ${accounts.length} contas encontradas`);

  for (const account of accounts) {
    const { data: upsertedAccount, error } = await supabase
      .from("accounts")
      .upsert(
        {
          item_id: dbItem.id,
          pluggy_account_id: account.id,
          name: account.name,
          type: account.subtype || account.type,
          balance: account.balance,
          credit_limit: account.creditData?.creditLimit || 0,
          currency: account.currencyCode,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "pluggy_account_id" }
      )
      .select()
      .single();

    if (error) {
      log(`  Erro upsert conta ${account.id}: ${error.message}`);
      continue;
    }

    accountCount++;

    // Se for conta de crédito, salvar dados do cartão
    if (account.type === "CREDIT" && account.creditData && upsertedAccount) {
      await syncCreditCard(supabase, upsertedAccount.id, account, institutionName, log);
      creditCardCount++;
    }
  }

  log(`  Contas: ${accountCount}, Cartões: ${creditCardCount}`);
  return { accounts: accountCount, creditCards: creditCardCount };
}

// Sincroniza dados do cartão de crédito
async function syncCreditCard(
  supabase: ReturnType<typeof createSupabaseServer>,
  dbAccountId: string,
  account: PluggyAccount,
  institutionName: string,
  log: (msg: string) => void
) {
  const creditData = account.creditData!;
  const last4 = account.number?.slice(-4) || "****";

  const { error } = await supabase
    .from("credit_cards")
    .upsert(
      {
        account_id: dbAccountId,
        name: `${institutionName} ${creditData.brand || ""}`.trim(),
        last4,
        balance: Math.abs(account.balance),
        limit: creditData.creditLimit || 0,
        available_limit: creditData.availableCreditLimit || 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "account_id" }
    );

  if (error) {
    log(`  Erro upsert cartão ${dbAccountId}: ${error.message}`);
  }
}

// Sincroniza transações dos últimos 90 dias
async function syncTransactions(
  pluggy: ReturnType<typeof createPluggyClient>,
  supabase: ReturnType<typeof createSupabaseServer>,
  dbItem: { id: string; item_id: string },
  log: (msg: string) => void
) {
  let count = 0;

  const { data: dbAccounts } = await supabase
    .from("accounts")
    .select("id, pluggy_account_id")
    .eq("item_id", dbItem.id);

  if (!dbAccounts || dbAccounts.length === 0) {
    log("  Nenhuma conta no DB para buscar transações");
    return 0;
  }

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const fromDate = ninetyDaysAgo.toISOString().split("T")[0];

  for (const dbAccount of dbAccounts) {
    try {
      log(`  Buscando transações da conta ${dbAccount.pluggy_account_id}...`);
      const transactions = await pluggy.fetchAllTransactions(
        dbAccount.pluggy_account_id,
        { from: fromDate }
      );

      log(`  ${transactions.length} transações encontradas`);

      const batch = transactions.map((tx: PluggyTransaction) => ({
        account_id: dbAccount.id,
        pluggy_transaction_id: tx.id,
        description: tx.description,
        amount: tx.amount,
        date: typeof tx.date === "string"
          ? tx.date
          : new Date(tx.date).toISOString().split("T")[0],
        category: tx.category || null,
        type: tx.type,
      }));

      if (batch.length > 0) {
        for (let i = 0; i < batch.length; i += 500) {
          const chunk = batch.slice(i, i + 500);
          const { error } = await supabase
            .from("transactions")
            .upsert(chunk, { onConflict: "pluggy_transaction_id" });
          if (error) {
            log(`  Erro upsert transações (chunk ${i}): ${error.message}`);
          }
        }
        count += batch.length;
      }
    } catch (txError) {
      const msg = txError instanceof Error ? txError.message : String(txError);
      log(`  Erro transações conta ${dbAccount.pluggy_account_id}: ${msg}`);
    }
  }

  return count;
}

// Sincroniza investimentos
async function syncInvestments(
  pluggy: ReturnType<typeof createPluggyClient>,
  supabase: ReturnType<typeof createSupabaseServer>,
  dbItem: { id: string; item_id: string },
  log: (msg: string) => void
) {
  let count = 0;

  try {
    log(`  Buscando investimentos...`);
    const { results: investments } = await pluggy.fetchInvestments(dbItem.item_id);
    log(`  ${investments.length} investimentos encontrados`);

    for (const inv of investments) {
      const { error } = await supabase
        .from("investments")
        .upsert(
          {
            item_id: dbItem.id,
            pluggy_investment_id: inv.id,
            name: inv.name,
            type: inv.type,
            balance: inv.balance,
            quantity: inv.quantity || 0,
            value: inv.value || 0,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "pluggy_investment_id" }
        );
      if (error) {
        log(`  Erro upsert investimento ${inv.id}: ${error.message}`);
      }
      count++;
    }
  } catch (invError) {
    const msg = invError instanceof Error ? invError.message : String(invError);
    log(`  Investimentos indisponíveis: ${msg}`);
  }

  return count;
}

// Sincroniza empréstimos e financiamentos
async function syncLoans(
  pluggy: ReturnType<typeof createPluggyClient>,
  supabase: ReturnType<typeof createSupabaseServer>,
  dbItem: { id: string; item_id: string },
  institutionName: string,
  log: (msg: string) => void
) {
  let count = 0;

  try {
    log(`  Buscando empréstimos...`);
    const { results: loans } = await pluggy.fetchLoans(dbItem.item_id);
    log(`  ${loans.length} empréstimos encontrados`);

    for (const loan of loans) {
      const { error } = await supabase
        .from("loans")
        .upsert(
          {
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
          },
          { onConflict: "pluggy_loan_id" }
        );
      if (error) {
        log(`  Erro upsert empréstimo ${loan.id}: ${error.message}`);
      }
      count++;
    }
  } catch (loanError) {
    const msg = loanError instanceof Error ? loanError.message : String(loanError);
    log(`  Empréstimos indisponíveis: ${msg}`);
  }

  return count;
}

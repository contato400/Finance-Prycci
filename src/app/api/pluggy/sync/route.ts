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
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const pluggy = createPluggyClient();
    const supabase = createSupabaseServer();

    // 1. Buscar TODOS os items existentes na API Pluggy
    const pluggyItems = await fetchAllItems();

    if (pluggyItems.length === 0) {
      return NextResponse.json({
        message: "Nenhum item encontrado na Pluggy. Adicione um banco primeiro.",
        synced: false,
        itemsFound: 0,
      });
    }

    // 2. Salvar cada item no Supabase (upsert pelo item_id)
    const dbItems: Array<{ id: string; item_id: string; institution_name: string }> = [];

    for (const pluggyItem of pluggyItems) {
      const { data: upserted } = await supabase
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

      if (upserted) {
        dbItems.push(upserted);
      }
    }

    // 3. Sincronizar dados de cada item
    const results = {
      itemsFound: pluggyItems.length,
      itemsSynced: 0,
      accounts: 0,
      transactions: 0,
      creditCards: 0,
      investments: 0,
      loans: 0,
    };

    for (const dbItem of dbItems) {
      try {
        // Sincronizar contas e cartões
        const accountsResult = await syncAccounts(
          pluggy, supabase, dbItem, dbItem.institution_name
        );
        results.accounts += accountsResult.accounts;
        results.creditCards += accountsResult.creditCards;

        // Sincronizar transações dos últimos 90 dias
        results.transactions += await syncTransactions(
          pluggy, supabase, dbItem
        );

        // Sincronizar investimentos
        results.investments += await syncInvestments(pluggy, supabase, dbItem);

        // Sincronizar empréstimos
        results.loans += await syncLoans(
          pluggy, supabase, dbItem, dbItem.institution_name
        );

        results.itemsSynced++;
      } catch {
        // Continua com os outros items mesmo se um falhar
      }
    }

    return NextResponse.json({
      message: `Sincronização concluída: ${results.itemsFound} items encontrados, ${results.itemsSynced} sincronizados.`,
      synced: true,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro na sincronização";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Sincroniza contas bancárias e cartões de crédito
async function syncAccounts(
  pluggy: ReturnType<typeof createPluggyClient>,
  supabase: ReturnType<typeof createSupabaseServer>,
  dbItem: { id: string; item_id: string },
  institutionName: string
) {
  let accountCount = 0;
  let creditCardCount = 0;

  const { results: accounts } = await pluggy.fetchAccounts(dbItem.item_id);

  for (const account of accounts) {
    const { data: upsertedAccount } = await supabase
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

    accountCount++;

    // Se for conta de crédito, salvar dados do cartão
    if (account.type === "CREDIT" && account.creditData && upsertedAccount) {
      await syncCreditCard(supabase, upsertedAccount.id, account, institutionName);
      creditCardCount++;
    }
  }

  return { accounts: accountCount, creditCards: creditCardCount };
}

// Sincroniza dados do cartão de crédito
async function syncCreditCard(
  supabase: ReturnType<typeof createSupabaseServer>,
  dbAccountId: string,
  account: PluggyAccount,
  institutionName: string
) {
  const creditData = account.creditData!;
  const last4 = account.number?.slice(-4) || "****";

  await supabase
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
}

// Sincroniza transações dos últimos 90 dias
async function syncTransactions(
  pluggy: ReturnType<typeof createPluggyClient>,
  supabase: ReturnType<typeof createSupabaseServer>,
  dbItem: { id: string; item_id: string }
) {
  let count = 0;

  // Buscar contas no DB para este item
  const { data: dbAccounts } = await supabase
    .from("accounts")
    .select("id, pluggy_account_id")
    .eq("item_id", dbItem.id);

  if (!dbAccounts || dbAccounts.length === 0) return 0;

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const fromDate = ninetyDaysAgo.toISOString().split("T")[0];

  for (const dbAccount of dbAccounts) {
    try {
      const transactions = await pluggy.fetchAllTransactions(
        dbAccount.pluggy_account_id,
        { from: fromDate }
      );

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
          await supabase
            .from("transactions")
            .upsert(chunk, { onConflict: "pluggy_transaction_id" });
        }
        count += batch.length;
      }
    } catch {
      // Continua com as outras contas
    }
  }

  return count;
}

// Sincroniza investimentos
async function syncInvestments(
  pluggy: ReturnType<typeof createPluggyClient>,
  supabase: ReturnType<typeof createSupabaseServer>,
  dbItem: { id: string; item_id: string }
) {
  let count = 0;

  try {
    const { results: investments } = await pluggy.fetchInvestments(dbItem.item_id);

    for (const inv of investments) {
      await supabase
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
      count++;
    }
  } catch {
    // Investimentos podem não estar disponíveis para todos os conectores
  }

  return count;
}

// Sincroniza empréstimos e financiamentos
async function syncLoans(
  pluggy: ReturnType<typeof createPluggyClient>,
  supabase: ReturnType<typeof createSupabaseServer>,
  dbItem: { id: string; item_id: string },
  institutionName: string
) {
  let count = 0;

  try {
    const { results: loans } = await pluggy.fetchLoans(dbItem.item_id);

    for (const loan of loans) {
      await supabase
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
      count++;
    }
  } catch {
    // Empréstimos podem não estar disponíveis para todos os conectores
  }

  return count;
}

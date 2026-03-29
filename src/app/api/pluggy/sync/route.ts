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

    // 1. Testar DB
    log("Testando PostgreSQL...");
    try {
      const [{ total }] = await sql`SELECT count(*) as total FROM pluggy_items`;
      log(`PostgreSQL OK — ${total} items no banco`);
    } catch (dbErr) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      log(`PostgreSQL ERRO: ${msg}`);
      return NextResponse.json({ error: `DB: ${msg}`, logs }, { status: 500 });
    }

    // 2. Buscar items do banco
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

    // 3. Sincronizar
    const pluggy = createPluggyClient();
    const results = { itemsFound: savedItems.length, itemsSynced: 0, accounts: 0, transactions: 0, creditCards: 0, investments: 0, loans: 0 };
    const itemErrors: Array<{ itemId: string; institution: string; error: string }> = [];

    for (const dbItem of savedItems) {
      try {
        log(`Sincronizando ${dbItem.institution_name} (${dbItem.item_id})...`);
        const item = await pluggy.fetchItem(dbItem.item_id);
        log(`  Status: ${item.status}`);

        await sql`
          UPDATE pluggy_items SET status = ${item.status}, institution_name = ${item.connector.name}
          WHERE id = ${dbItem.id}::uuid
        `;

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
      synced: results.itemsSynced > 0, results,
      itemErrors: itemErrors.length > 0 ? itemErrors : undefined, logs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`ERRO FATAL: ${message}`);
    return NextResponse.json({ error: message, logs }, { status: 500 });
  }
}

async function syncAccounts(
  pluggy: Pluggy, dbItem: { id: string; item_id: string },
  institutionName: string, log: LogFn
) {
  let accountCount = 0, creditCardCount = 0;

  const { results: accounts } = await pluggy.fetchAccounts(dbItem.item_id);
  log(`  ${accounts.length} contas`);

  for (const account of accounts) {
    try {
      const [upserted] = await sql`
        INSERT INTO accounts (item_id, pluggy_account_id, name, type, balance, credit_limit, currency, updated_at)
        VALUES (${dbItem.id}::uuid, ${account.id}, ${account.name}, ${account.subtype || account.type},
                ${account.balance}, ${account.creditData?.creditLimit || 0}, ${account.currencyCode}, now())
        ON CONFLICT (pluggy_account_id) DO UPDATE SET
          name = EXCLUDED.name, type = EXCLUDED.type, balance = EXCLUDED.balance,
          credit_limit = EXCLUDED.credit_limit, currency = EXCLUDED.currency, updated_at = now()
        RETURNING id
      `;
      accountCount++;

      if (account.type === "CREDIT" && account.creditData && upserted) {
        const cd = account.creditData;
        await sql`
          INSERT INTO credit_cards (account_id, name, last4, balance, credit_limit, available_limit, updated_at)
          VALUES (${upserted.id}::uuid, ${`${institutionName} ${cd.brand || ""}`.trim()},
                  ${account.number?.slice(-4) || "****"}, ${Math.abs(account.balance)},
                  ${cd.creditLimit || 0}, ${cd.availableCreditLimit || 0}, now())
          ON CONFLICT (account_id) DO UPDATE SET
            name = EXCLUDED.name, last4 = EXCLUDED.last4, balance = EXCLUDED.balance,
            credit_limit = EXCLUDED.credit_limit, available_limit = EXCLUDED.available_limit, updated_at = now()
        `;
        creditCardCount++;
      }
    } catch (e) {
      log(`  Erro conta ${account.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { accounts: accountCount, creditCards: creditCardCount };
}

async function syncTransactions(pluggy: Pluggy, dbItem: { id: string; item_id: string }, log: LogFn) {
  let count = 0;

  const dbAccounts = await sql<{ id: string; pluggy_account_id: string }[]>`
    SELECT id, pluggy_account_id FROM accounts WHERE item_id = ${dbItem.id}::uuid
  `;
  if (!dbAccounts.length) return 0;

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 90);
  const from = fromDate.toISOString().split("T")[0];

  for (const acct of dbAccounts) {
    try {
      const txs = await pluggy.fetchAllTransactions(acct.pluggy_account_id, { from });
      log(`  ${txs.length} transações (${acct.pluggy_account_id.substring(0, 8)}...)`);

      // Inserir em lotes de 500
      for (let i = 0; i < txs.length; i += 500) {
        const chunk = txs.slice(i, i + 500);
        const values = chunk.map((tx: PluggyTransaction) => ({
          account_id: acct.id,
          pluggy_transaction_id: tx.id,
          description: tx.description,
          amount: tx.amount,
          date: typeof tx.date === "string" ? tx.date : new Date(tx.date).toISOString().split("T")[0],
          category: tx.category || null,
          type: tx.type,
        }));

        // Usar INSERT ... VALUES com unnest para batch
        for (const v of values) {
          await sql`
            INSERT INTO transactions (account_id, pluggy_transaction_id, description, amount, date, category, type)
            VALUES (${v.account_id}::uuid, ${v.pluggy_transaction_id}, ${v.description},
                    ${v.amount}, ${v.date}, ${v.category}, ${v.type})
            ON CONFLICT (pluggy_transaction_id) DO UPDATE SET
              description = EXCLUDED.description, amount = EXCLUDED.amount,
              date = EXCLUDED.date, category = EXCLUDED.category, type = EXCLUDED.type
          `;
        }
      }
      count += txs.length;
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

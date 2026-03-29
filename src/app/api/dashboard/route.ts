import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";

// Retorna dados agregados para o dashboard
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Buscar tudo em paralelo
    const [items, accounts, creditCards, investments, transactions] = await Promise.all([
      sql`SELECT id FROM pluggy_items`,
      sql`SELECT a.id, a.item_id, a.type, a.balance, p.institution_name
          FROM accounts a JOIN pluggy_items p ON a.item_id = p.id`,
      sql`SELECT cc.id, cc.account_id, cc.balance, cc.credit_limit, a.item_id
          FROM credit_cards cc JOIN accounts a ON cc.account_id = a.id`,
      sql`SELECT balance FROM investments`,
      sql`SELECT date, amount FROM transactions WHERE date >= ${thirtyDaysAgo} ORDER BY date ASC`,
    ]);

    // Mapa item_id → institution_name
    const instMap = new Map<string, string>();
    for (const a of accounts) instMap.set(a.item_id, a.institution_name);

    // Métricas
    const bankAccounts = accounts.filter(
      (a) => a.type === "CHECKING_ACCOUNT" || a.type === "SAVINGS_ACCOUNT" || a.type === "BANK"
    );
    const totalBalance = bankAccounts.reduce((s, a) => s + Number(a.balance), 0);
    const totalCreditUsed = creditCards.reduce((s, c) => s + Number(c.balance), 0);
    const totalCreditLimit = creditCards.reduce((s, c) => s + Number(c.credit_limit), 0);
    const totalInvested = investments.reduce((s, i) => s + Number(i.balance), 0);
    const netBalance = totalBalance - totalCreditUsed;

    // Agrupar por instituição
    const instData = new Map<string, { name: string; balance: number; creditLimit: number; creditUsed: number }>();

    for (const a of bankAccounts) {
      const name = a.institution_name || "Desconhecido";
      const e = instData.get(name) || { name, balance: 0, creditLimit: 0, creditUsed: 0 };
      e.balance += Number(a.balance);
      instData.set(name, e);
    }

    for (const c of creditCards) {
      const name = instMap.get(c.item_id) || "Desconhecido";
      const e = instData.get(name) || { name, balance: 0, creditLimit: 0, creditUsed: 0 };
      e.creditLimit += Number(c.credit_limit);
      e.creditUsed += Number(c.balance);
      instData.set(name, e);
    }

    const institutions = Array.from(instData.values());

    // Evolução do saldo
    const txByDay = new Map<string, number>();
    for (const tx of transactions) txByDay.set(tx.date, (txByDay.get(tx.date) || 0) + Number(tx.amount));

    const balanceHistory: { date: string; balance: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayDelta = txByDay.get(dateStr) || 0;
      balanceHistory.push({ date: dateStr, balance: Math.round((totalBalance - dayDelta * (i / 10)) * 100) / 100 });
    }

    return NextResponse.json({
      totalBalance, totalCreditUsed, totalCreditLimit, totalInvested, netBalance,
      institutions, balanceHistory, connectedBanks: items.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar dashboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

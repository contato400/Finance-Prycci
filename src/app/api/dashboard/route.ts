import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

// Dashboard: agrega dados de todas as tabelas
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Todas as queries em paralelo
    const [
      items,
      allAccounts,
      investmentTotals,
      transactions,
    ] = await Promise.all([
      sql`SELECT id, institution_name FROM pluggy_items`,
      sql`SELECT a.id, a.item_id, a.type, a.name, a.balance, a.credit_limit,
                 p.institution_name
          FROM accounts a JOIN pluggy_items p ON a.item_id = p.id`,
      sql`SELECT COALESCE(SUM(balance), 0) as total FROM investments`,
      sql`SELECT date::text as date, amount FROM transactions
          WHERE date >= ${thirtyDaysAgo} ORDER BY date ASC`,
    ]);

    // Separar contas bancárias e contas de crédito (cartões)
    const bankAccounts = allAccounts.filter((a) => a.type !== "CREDIT" && a.type !== "CREDIT_CARD");
    const creditAccounts = allAccounts.filter((a) => a.type === "CREDIT" || a.type === "CREDIT_CARD");

    // Métricas
    const totalBalance = bankAccounts.reduce((s, a) => s + Number(a.balance), 0);
    const totalCreditUsed = creditAccounts.reduce((s, a) => s + Math.abs(Number(a.balance)), 0);
    const totalCreditLimit = creditAccounts.reduce((s, a) => s + Number(a.credit_limit || 0), 0);
    const totalInvested = Number(investmentTotals[0]?.total || 0);
    const netBalance = totalBalance - totalCreditUsed;

    // Agrupar por instituição (pluggy_items)
    const instData = new Map<string, { name: string; balance: number; creditLimit: number; creditUsed: number }>();

    for (const a of bankAccounts) {
      const name = a.institution_name || "Desconhecido";
      const e = instData.get(name) || { name, balance: 0, creditLimit: 0, creditUsed: 0 };
      e.balance += Number(a.balance);
      instData.set(name, e);
    }

    for (const a of creditAccounts) {
      const name = a.institution_name || "Desconhecido";
      const e = instData.get(name) || { name, balance: 0, creditLimit: 0, creditUsed: 0 };
      e.creditLimit += Number(a.credit_limit || 0);
      e.creditUsed += Math.abs(Number(a.balance));
      instData.set(name, e);
    }

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
      institutions: Array.from(instData.values()),
      balanceHistory,
      connectedBanks: items.length,
      _debug: {
        items: items.length,
        allAccounts: allAccounts.length,
        bankAccounts: bankAccounts.length,
        creditAccounts: creditAccounts.length,
        transactions: transactions.length,
        accountTypes: allAccounts.map((a) => a.type),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar dashboard";
    return NextResponse.json({ error: message, stack: error instanceof Error ? error.stack : undefined }, { status: 500 });
  }
}

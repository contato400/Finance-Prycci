"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryChart } from "@/components/contas/category-chart";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useDateRange } from "@/contexts/date-range-context";
import { BankAvatar } from "@/components/bank-avatar";
import {
  Landmark,
  ChevronLeft,
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  Send,
} from "lucide-react";

interface Account {
  id: string;
  pluggy_account_id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  updated_at: string;
  pluggy_items: { institution_name: string } | null;
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string | null;
  type: string;
}

interface TopTransfer {
  destinatario: string;
  total: number;
  qtd: number;
}

interface ContasData {
  accounts: Account[];
  transactions: Transaction[] | null;
  totalTransactions: number;
  page: number;
  totalPages: number;
  categoryData: Array<{ category: string; total: number }>;
  topTransfers: TopTransfer[];
}

type FilterType = "ALL" | "CHECKING_ACCOUNT" | "SAVINGS_ACCOUNT";

export default function ContasPage() {
  const [data, setData] = useState<ContasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const { startStr, endStr, label: periodLabel } = useDateRange();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("start", startStr);
    params.set("end", endStr);
    if (filter !== "ALL") params.set("type", filter);
    if (selectedAccount) {
      params.set("accountId", selectedAccount);
      params.set("page", page.toString());
    }
    try {
      const res = await fetch(`/api/contas?${params}`);
      const json = await res.json();
      setData(json);
    } catch {
      // Erro silencioso
    } finally {
      setLoading(false);
    }
  }, [filter, selectedAccount, page, startStr, endStr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page ao mudar conta
  useEffect(() => {
    setPage(1);
  }, [selectedAccount]);

  if (loading && !data) return <ContasSkeleton />;

  const filterButtons: { label: string; value: FilterType }[] = [
    { label: "Todas", value: "ALL" },
    { label: "Corrente", value: "CHECKING_ACCOUNT" },
    { label: "Poupança", value: "SAVINGS_ACCOUNT" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Contas</h1>
        <p className="text-sm text-slate-400">Suas contas bancárias e extrato</p>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-slate-400" />
        {filterButtons.map((btn) => (
          <Button
            key={btn.value}
            variant={filter === btn.value ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setFilter(btn.value);
              setSelectedAccount(null);
            }}
            className={
              filter === btn.value
                ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                : "border-slate-700 text-slate-300"
            }
          >
            {btn.label}
          </Button>
        ))}
      </div>

      {/* Lista de contas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.accounts.map((account) => (
          <Card
            key={account.id}
            className={`cursor-pointer border-slate-800 bg-slate-900 transition-all hover:border-slate-700 ${
              selectedAccount === account.id ? "border-emerald-500/50 ring-1 ring-emerald-500/30" : ""
            }`}
            onClick={() =>
              setSelectedAccount(selectedAccount === account.id ? null : account.id)
            }
          >
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <BankAvatar bankName={account.pluggy_items?.institution_name || account.name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {account.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {account.pluggy_items?.institution_name || "—"}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">Saldo</p>
                  <p className={`text-lg font-bold ${account.balance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {formatCurrency(account.balance)}
                  </p>
                </div>
                <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-400">
                  {account.type === "CHECKING_ACCOUNT"
                    ? "Corrente"
                    : account.type === "SAVINGS_ACCOUNT"
                      ? "Poupança"
                      : account.type}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {data?.accounts.length === 0 && (
        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="flex flex-col items-center py-12">
            <Landmark className="mb-4 h-12 w-12 text-slate-600" />
            <p className="text-sm text-slate-400">
              Nenhuma conta encontrada. Conecte um banco no Dashboard.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Extrato — só aparece quando uma conta está selecionada */}
      {selectedAccount && data?.transactions && (
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white">
              Movimentações • {periodLabel} ({data.totalTransactions} transações)
            </CardTitle>
            <span className="text-xs text-slate-500">
              {data.totalTransactions} transações
            </span>
          </CardHeader>
          <CardContent>
            {data.transactions.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                        <th className="pb-3 font-medium">Data</th>
                        <th className="pb-3 font-medium">Descrição</th>
                        <th className="hidden pb-3 font-medium sm:table-cell">Categoria</th>
                        <th className="pb-3 text-right font-medium">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.transactions.map((tx) => (
                        <tr
                          key={tx.id}
                          className="border-b border-slate-800/50 transition-colors hover:bg-slate-800/30"
                        >
                          <td className="py-3 text-slate-400">
                            {formatDate(tx.date)}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              {tx.type === "DEBIT" ? (
                                <ArrowUpRight className="h-3.5 w-3.5 text-red-400" />
                              ) : (
                                <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-400" />
                              )}
                              <span className="truncate text-white">
                                {tx.description}
                              </span>
                            </div>
                          </td>
                          <td className="hidden py-3 sm:table-cell">
                            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                              {tx.category || "—"}
                            </span>
                          </td>
                          <td
                            className={`py-3 text-right font-medium ${
                              tx.type === "DEBIT"
                                ? "text-red-400"
                                : "text-emerald-400"
                            }`}
                          >
                            {tx.type === "DEBIT" ? "- " : "+ "}
                            {formatCurrency(Math.abs(tx.amount))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Paginação */}
                {data.totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      Página {data.page} de {data.totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                        className="border-slate-700 text-slate-300"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= data.totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="border-slate-700 text-slate-300"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">
                Nenhuma transação nos últimos 30 dias
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Gráfico de gastos por categoria */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white">Gastos por Categoria • {periodLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryChart data={data?.categoryData || []} />
        </CardContent>
      </Card>

      {/* Top transferências enviadas */}
      {data?.topTransfers && data.topTransfers.length > 0 && (
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Send className="h-4 w-4 text-slate-400" />
              Para quem você mais transferiu • {periodLabel}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topTransfers.map((tf, i) => (
                <div
                  key={tf.destinatario}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-800/50"
                >
                  <span className="w-5 shrink-0 text-right text-sm font-bold text-slate-500">
                    {i + 1}.
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {tf.destinatario}
                    </p>
                    <p className="text-xs text-slate-500">
                      {tf.qtd} transferência{tf.qtd !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-red-400">
                    {formatCurrency(tf.total)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ContasSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-lg" />
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCardVisual } from "@/components/cartoes/credit-card-visual";
import { formatCurrency, formatDate, calcPercentage } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { useDateRange } from "@/contexts/date-range-context";
import {
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

interface CreditCardData {
  id: string;
  name: string;
  last4: string;
  balance: number;
  credit_limit: number;
  available_limit: number;
  accounts?: {
    id: string;
    pluggy_account_id: string;
    pluggy_items?: { institution_name: string } | null;
  } | null;
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string | null;
  type: string;
}

interface CartoesData {
  cards: CreditCardData[];
  transactions: Transaction[] | null;
  totalUsed: number;
  totalLimit: number;
  totalAvailable: number;
}

export default function CartoesPage() {
  const [data, setData] = useState<CartoesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const { startStr, endStr } = useDateRange();

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("start", startStr);
    params.set("end", endStr);
    if (selectedCard) params.set("cardId", selectedCard);
    try {
      const res = await apiFetch(`/api/cartoes?${params}`);
      const json = await res.json();
      setData(json);
    } catch {
      // Erro silencioso
    } finally {
      setLoading(false);
    }
  }, [selectedCard, startStr, endStr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !data) return <CartoesSkeleton />;

  const totalPercent = data ? calcPercentage(data.totalUsed, data.totalLimit) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Cartões de Crédito</h1>
        <p className="text-sm text-slate-400">Gerencie seus cartões e limites</p>
      </div>

      {/* Resumo no topo */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
              <Wallet className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Utilizado</p>
              <p className="text-lg font-bold text-white">{formatCurrency(data?.totalUsed || 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-500/10">
              <CreditCard className="h-5 w-5 text-slate-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Limite Total</p>
              <p className="text-lg font-bold text-white">{formatCurrency(data?.totalLimit || 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="flex items-center gap-4 p-5">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              totalPercent > 80 ? "bg-red-500/10" : "bg-emerald-500/10"
            }`}>
              {totalPercent > 80 ? (
                <AlertTriangle className="h-5 w-5 text-red-400" />
              ) : (
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500">Disponível</p>
              <p className={`text-lg font-bold ${totalPercent > 80 ? "text-red-400" : "text-emerald-400"}`}>
                {formatCurrency(data?.totalAvailable || 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid de cartões visuais */}
      {data?.cards && data.cards.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.cards.map((card) => (
            <CreditCardVisual
              key={card.id}
              card={card}
              selected={selectedCard === card.id}
              onClick={() =>
                setSelectedCard(selectedCard === card.id ? null : card.id)
              }
            />
          ))}
        </div>
      ) : (
        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="flex flex-col items-center py-12">
            <CreditCard className="mb-4 h-12 w-12 text-slate-600" />
            <p className="text-sm text-slate-400">
              Nenhum cartão de crédito encontrado. Conecte um banco no Dashboard.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Transações recentes do cartão selecionado */}
      {selectedCard && data?.transactions && (
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle className="text-white">Transações Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {data.transactions.length > 0 ? (
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
                        <td className="py-3 text-slate-400">{formatDate(tx.date)}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            {tx.type === "DEBIT" ? (
                              <ArrowUpRight className="h-3.5 w-3.5 text-red-400" />
                            ) : (
                              <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-400" />
                            )}
                            <span className="truncate text-white">{tx.description}</span>
                          </div>
                        </td>
                        <td className="hidden py-3 sm:table-cell">
                          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                            {tx.category || "—"}
                          </span>
                        </td>
                        <td className={`py-3 text-right font-medium ${
                          tx.type === "DEBIT" ? "text-red-400" : "text-emerald-400"
                        }`}>
                          {tx.type === "DEBIT" ? "- " : "+ "}
                          {formatCurrency(Math.abs(tx.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">
                Nenhuma transação recente
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CartoesSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-60" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

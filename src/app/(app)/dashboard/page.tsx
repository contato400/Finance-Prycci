"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { PluggyWidget } from "@/components/pluggy/pluggy-widget";
import { InstitutionCard } from "@/components/dashboard/institution-card";
import { formatCurrency, calcPercentage } from "@/lib/utils";
import { useDateRange } from "@/contexts/date-range-context";
import {
  Wallet, CreditCard, TrendingUp, DollarSign, Building2,
  AlertCircle, ArrowDownLeft, ArrowUpRight, Scale,
} from "lucide-react";

interface DashboardData {
  totalBalance: number;
  totalCreditUsed: number;
  totalCreditLimit: number;
  totalInvested: number;
  netBalance: number;
  institutions: Array<{ name: string; balance: number; creditLimit: number; creditUsed: number }>;
  connectedBanks: number;
  periodIncome: number;
  periodExpenses: number;
  periodNet: number;
  topCategories: Array<{ category: string; total: number }>;
  needsSync?: boolean;
  message?: string;
  cachedAt?: string;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { startStr, endStr, label: periodLabel } = useDateRange();

  useEffect(() => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    fetch(`/api/dashboard?start=${startStr}&end=${endStr}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.error) { setError(json.error || `Erro ${res.status}`); return; }
        setData(json);
      })
      .catch((err) => { if (err.name !== "AbortError") setError(err.message || "Erro de rede"); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [startStr, endStr]);

  const totalBalance = data?.totalBalance ?? 0;
  const totalCreditUsed = data?.totalCreditUsed ?? 0;
  const totalCreditLimit = data?.totalCreditLimit ?? 0;
  const creditPercent = calcPercentage(totalCreditUsed, totalCreditLimit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400">Visão geral das suas finanças</p>
        </div>
        <PluggyWidget />
      </div>

      {error && (
        <Card className="border-red-800 bg-red-950/30">
          <CardContent className="flex items-center gap-3 p-5">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-red-300">Erro ao carregar</p>
              <p className="truncate text-xs text-red-400">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {data?.needsSync && (
        <Card className="border-emerald-800 bg-emerald-950/20">
          <CardContent className="flex items-center gap-3 p-5">
            <Wallet className="h-5 w-5 text-emerald-400" />
            <p className="text-sm text-emerald-300">{data.message || "Clique em Sincronizar."}</p>
          </CardContent>
        </Card>
      )}

      {data?.cachedAt && (
        <p className="text-xs text-slate-600">
          Dados de {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(data.cachedAt))}
        </p>
      )}

      {/* Saldos atuais (do cache — não mudam com período) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)
        ) : (
          <>
            <MiniCard title="Saldo em Contas" value={formatCurrency(totalBalance)} icon={<Wallet className="h-5 w-5 text-emerald-500" />} />
            <Card className="border-slate-800 bg-slate-900">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Crédito Utilizado</CardTitle>
                <CreditCard className="h-5 w-5 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{formatCurrency(totalCreditUsed)}</div>
                <p className="mt-1 text-xs text-slate-500">de {formatCurrency(totalCreditLimit)} limite</p>
                <Progress value={creditPercent} className={`mt-3 h-2 ${creditPercent > 70 ? "[&>div]:bg-red-500" : creditPercent > 50 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-emerald-500"}`} />
                <p className={`mt-1 text-xs ${creditPercent > 70 ? "text-red-400" : "text-slate-500"}`}>{creditPercent}% utilizado</p>
              </CardContent>
            </Card>
            <MiniCard title="Total Investido" value={formatCurrency(data?.totalInvested ?? 0)} icon={<TrendingUp className="h-5 w-5 text-blue-500" />} />
            <MiniCard title="Saldo Líquido" value={formatCurrency(data?.netBalance ?? 0)} icon={<DollarSign className="h-5 w-5 text-emerald-500" />} color={(data?.netBalance ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"} />
          </>
        )}
      </div>

      {/* Movimentações do período (mudam com DateRangePicker) */}
      {!loading && !data?.needsSync && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-slate-800 bg-slate-900">
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="h-4 w-4 text-emerald-400" />
                <p className="text-xs text-slate-500">Receitas • {periodLabel}</p>
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-400">{formatCurrency(data?.periodIncome ?? 0)}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-900">
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-red-400" />
                <p className="text-xs text-slate-500">Gastos • {periodLabel}</p>
              </div>
              <p className="mt-2 text-2xl font-bold text-red-400">{formatCurrency(data?.periodExpenses ?? 0)}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-900">
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-slate-400" />
                <p className="text-xs text-slate-500">Resultado • {periodLabel}</p>
              </div>
              <p className={`mt-2 text-2xl font-bold ${(data?.periodNet ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {(data?.periodNet ?? 0) >= 0 ? "+" : ""}{formatCurrency(data?.periodNet ?? 0)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top categorias do período */}
      {!loading && data?.topCategories && data.topCategories.length > 0 && (
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle className="text-sm text-white">Maiores Gastos • {periodLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topCategories.map((cat, i) => (
                <div key={cat.category} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600">{i + 1}.</span>
                    <span className="text-sm text-slate-300">{cat.category}</span>
                  </div>
                  <span className="text-sm font-medium text-white">{formatCurrency(cat.total)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bancos conectados */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-white">Bancos Conectados</h2>
          {!loading && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">{data?.connectedBanks ?? 0}</span>}
        </div>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
          </div>
        ) : data?.institutions && data.institutions.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.institutions.map((inst) => <InstitutionCard key={inst.name} institution={inst} />)}
          </div>
        ) : (
          <Card className="border-slate-800 bg-slate-900">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="mb-4 h-12 w-12 text-slate-600" />
              <p className="text-sm text-slate-400">Nenhum banco conectado. Clique em &quot;Adicionar Banco&quot; para começar.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function MiniCard({ title, value, icon, color = "text-white" }: { title: string; value: string; icon: React.ReactNode; color?: string }) {
  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-400">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent><div className={`text-2xl font-bold ${color}`}>{value}</div></CardContent>
    </Card>
  );
}

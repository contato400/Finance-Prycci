"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { PluggyWidget } from "@/components/pluggy/pluggy-widget";
import { BalanceChart } from "@/components/dashboard/balance-chart";
import { InstitutionCard } from "@/components/dashboard/institution-card";
import { formatCurrency, calcPercentage } from "@/lib/utils";
import {
  Wallet,
  CreditCard,
  TrendingUp,
  DollarSign,
  Building2,
  AlertCircle,
} from "lucide-react";

interface DashboardData {
  totalBalance: number;
  totalCreditUsed: number;
  totalCreditLimit: number;
  totalInvested: number;
  netBalance: number;
  institutions: Array<{
    name: string;
    balance: number;
    creditLimit: number;
    creditUsed: number;
  }>;
  balanceHistory: Array<{ date: string; balance: number }>;
  connectedBanks: number;
  needsSync?: boolean;
  message?: string;
  cachedAt?: string;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/dashboard", { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.error) {
          setError(json.error || `Erro ${res.status}`);
          return;
        }
        setData(json);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message || "Erro de rede");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  // Métricas disponíveis mesmo durante loading parcial
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

      {/* Erro */}
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

      {/* Precisa sincronizar */}
      {data?.needsSync && (
        <Card className="border-emerald-800 bg-emerald-950/20">
          <CardContent className="flex items-center gap-3 p-5">
            <Wallet className="h-5 w-5 text-emerald-400" />
            <p className="text-sm text-emerald-300">
              {data.message || "Clique em Sincronizar no topo para carregar seus dados."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Timestamp do cache */}
      {data?.cachedAt && (
        <p className="text-xs text-slate-600">
          Dados de {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(data.cachedAt))}
        </p>
      )}

      {/* Cards de métricas — skeleton se loading, dados se prontos */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))
        ) : (
          <>
            <MetricCard
              title="Saldo em Contas"
              value={formatCurrency(totalBalance)}
              icon={<Wallet className="h-5 w-5 text-emerald-500" />}
            />
            <Card className="border-slate-800 bg-slate-900">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Crédito Utilizado</CardTitle>
                <CreditCard className="h-5 w-5 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {formatCurrency(totalCreditUsed)}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  de {formatCurrency(totalCreditLimit)} limite
                </p>
                <Progress
                  value={creditPercent}
                  className={`mt-3 h-2 ${
                    creditPercent > 70 ? "[&>div]:bg-red-500"
                      : creditPercent > 50 ? "[&>div]:bg-yellow-500"
                        : "[&>div]:bg-emerald-500"
                  }`}
                />
                <p className={`mt-1 text-xs ${creditPercent > 70 ? "text-red-400" : "text-slate-500"}`}>
                  {creditPercent}% utilizado
                </p>
              </CardContent>
            </Card>
            <MetricCard
              title="Total Investido"
              value={formatCurrency(data?.totalInvested ?? 0)}
              icon={<TrendingUp className="h-5 w-5 text-blue-500" />}
            />
            <MetricCard
              title="Saldo Líquido"
              value={formatCurrency(data?.netBalance ?? 0)}
              icon={<DollarSign className="h-5 w-5 text-emerald-500" />}
              valueColor={(data?.netBalance ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}
            />
          </>
        )}
      </div>

      {/* Bancos conectados */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-white">Bancos Conectados</h2>
          {!loading && (
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
              {data?.connectedBanks ?? 0}
            </span>
          )}
        </div>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-lg" />
            ))}
          </div>
        ) : data?.institutions && data.institutions.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.institutions.map((inst) => (
              <InstitutionCard key={inst.name} institution={inst} />
            ))}
          </div>
        ) : (
          <Card className="border-slate-800 bg-slate-900">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="mb-4 h-12 w-12 text-slate-600" />
              <p className="text-sm text-slate-400">
                Nenhum banco conectado. Clique em &quot;Adicionar Banco&quot; para começar.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Gráfico */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white">Evolução do Saldo — Últimos 30 dias</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-72 w-full rounded" />
          ) : data?.balanceHistory && data.balanceHistory.length > 0 ? (
            <BalanceChart data={data.balanceHistory} />
          ) : (
            <div className="flex h-64 items-center justify-center">
              <p className="text-sm text-slate-500">Sem dados para exibir</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  title, value, icon, valueColor = "text-white",
}: {
  title: string; value: string; icon: React.ReactNode; valueColor?: string;
}) {
  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-400">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${valueColor}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

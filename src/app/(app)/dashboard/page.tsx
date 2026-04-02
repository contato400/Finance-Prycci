"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PluggyWidget } from "@/components/pluggy/pluggy-widget";
import { BankAvatar } from "@/components/bank-avatar";
import { formatCurrency, calcPercentage, formatDate } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { useDateRange } from "@/contexts/date-range-context";
import {
  Wallet, CreditCard, TrendingUp, DollarSign, Building2,
  AlertCircle, ArrowDownLeft, ArrowUpRight, Scale, ChevronRight,
} from "lucide-react";

interface BankData {
  name: string;
  status: string;
}

interface TopTransaction {
  id: string;
  description: string;
  valor: number;
  date: string;
  category: string;
  accountType: string;
  banco: string;
}

interface DashboardData {
  totalBalance: number;
  totalCreditUsed: number;
  totalCreditLimit: number;
  totalInvested: number;
  investmentCount: number;
  netBalance: number;
  banks: BankData[];
  connectedBanks: number;
  periodIncome: number;
  periodExpenses: number;
  periodNet: number;
  topTransactions: TopTransaction[];
  needsSync?: boolean;
  message?: string;
  cachedAt?: string;
}


// Badge de forma de pagamento
function PaymentBadge({ accountType, description }: { accountType: string; description: string }) {
  const desc = description.toUpperCase();
  if (accountType === "CREDIT" || accountType === "CREDIT_CARD") {
    return <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-medium text-purple-400">Crédito</span>;
  }
  if (desc.includes("PIX")) {
    return <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">Pix</span>;
  }
  if (desc.includes("BOLETO") || desc.includes("SLIP")) {
    return <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-medium text-orange-400">Boleto</span>;
  }
  return <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-400">Débito</span>;
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
    apiFetch(`/api/dashboard?start=${startStr}&end=${endStr}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) { setError(json.error || `HTTP ${res.status}`); return; }
        setData(json);
      })
      .catch((err) => { if (err.name !== "AbortError") setError(err.message || "Erro de rede"); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [startStr, endStr]);

  const totalBalance = data?.totalBalance ?? 0;
  const totalCreditUsed = data?.totalCreditUsed ?? 0;
  const totalCreditLimit = data?.totalCreditLimit ?? 0;
  const totalCreditAvailable = Math.max(totalCreditLimit - totalCreditUsed, 0);
  const creditPercent = calcPercentage(totalCreditUsed, totalCreditLimit);
  const totalInvested = data?.totalInvested ?? 0;
  const investmentCount = data?.investmentCount ?? 0;

  return (
    <div className="space-y-6">
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

      {/* Saldos atuais */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />) : (
          <>
            <MiniCard title="Saldo em Contas" value={formatCurrency(totalBalance)} icon={<Wallet className="h-5 w-5 text-emerald-500" />} />

            {/* Crédito Utilizado */}
            <Card className="border-slate-800 bg-slate-900">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Crédito Utilizado</CardTitle>
                <CreditCard className="h-5 w-5 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{formatCurrency(totalCreditUsed)}</div>
                <p className="mt-1 text-xs text-slate-500">de {formatCurrency(totalCreditLimit)} limite</p>
                <Progress value={creditPercent} className={`mt-3 h-2 ${creditPercent > 70 ? "[&>div]:bg-red-500" : creditPercent > 50 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-emerald-500"}`} />
                <div className="mt-1 flex items-center justify-between">
                  <p className={`text-xs ${creditPercent > 70 ? "text-red-400" : "text-slate-500"}`}>{creditPercent}% utilizado</p>
                  <p className="text-xs text-emerald-400">{formatCurrency(totalCreditAvailable)} disponível</p>
                </div>
              </CardContent>
            </Card>

            {/* Total Investido */}
            <Card className="border-slate-800 bg-slate-900">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Total Investido</CardTitle>
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{formatCurrency(totalInvested)}</div>
                <p className="mt-1 text-xs text-slate-500">
                  {investmentCount} ativo{investmentCount !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>

            <MiniCard title="Saldo Líquido" value={formatCurrency(data?.netBalance ?? 0)} icon={<DollarSign className="h-5 w-5 text-emerald-500" />} color={(data?.netBalance ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"} />
          </>
        )}
      </div>

      {/* Movimentações do período */}
      {!loading && !data?.needsSync && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-slate-800 bg-slate-900">
            <CardContent className="p-5">
              <div className="flex items-center gap-2"><ArrowDownLeft className="h-4 w-4 text-emerald-400" /><p className="text-xs text-slate-500">Receitas • {periodLabel}</p></div>
              <p className="mt-2 text-2xl font-bold text-emerald-400">{formatCurrency(data?.periodIncome ?? 0)}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-900">
            <CardContent className="p-5">
              <div className="flex items-center gap-2"><ArrowUpRight className="h-4 w-4 text-red-400" /><p className="text-xs text-slate-500">Gastos • {periodLabel}</p></div>
              <p className="mt-2 text-2xl font-bold text-red-400">{formatCurrency(data?.periodExpenses ?? 0)}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-900">
            <CardContent className="p-5">
              <div className="flex items-center gap-2"><Scale className="h-4 w-4 text-slate-400" /><p className="text-xs text-slate-500">Resultado • {periodLabel}</p></div>
              <p className={`mt-2 text-2xl font-bold ${(data?.periodNet ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {(data?.periodNet ?? 0) >= 0 ? "+" : ""}{formatCurrency(data?.periodNet ?? 0)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top 10 transações individuais */}
      {!loading && data?.topTransactions && data.topTransactions.length > 0 && (
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm text-white">Maiores Gastos • {periodLabel}</CardTitle>
            <Link href="/contas">
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-slate-400 hover:text-white">
                Ver todas <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topTransactions.map((tx, i) => (
                <div key={tx.id} className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-800/50">
                  <span className="mt-0.5 w-5 shrink-0 text-right text-xs font-medium text-slate-600">{i + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm leading-snug text-white">
                        {tx.description}
                      </p>
                      <PaymentBadge accountType={tx.accountType} description={tx.description} />
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-[10px] text-slate-600">{tx.banco}</span>
                      <span className="text-[10px] text-slate-700">•</span>
                      <span className="text-[10px] text-slate-600">{formatDate(tx.date)}</span>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-red-400">{formatCurrency(tx.valor)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bancos Conectados */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-white">Bancos Conectados</h2>
          {!loading && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">{data?.connectedBanks ?? 0}</span>}
        </div>
        {loading ? (
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-40 rounded-full" />)}
          </div>
        ) : data?.banks && data.banks.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {data.banks.map((bank) => <BankChip key={bank.name} bank={bank} />)}
          </div>
        ) : (
          <Card className="border-slate-800 bg-slate-900">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="mb-4 h-12 w-12 text-slate-600" />
              <p className="text-sm text-slate-400">Nenhum banco conectado. Clique em &quot;Adicionar Banco&quot;.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Chip compacto de banco conectado
function BankChip({ bank }: { bank: BankData }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5">
      <BankAvatar bankName={bank.name} size={24} />
      <span className="text-sm font-medium text-white">{bank.name}</span>
      <div className={`h-2 w-2 rounded-full ${bank.status === "UPDATED" ? "bg-emerald-400" : "bg-yellow-400"}`} />
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

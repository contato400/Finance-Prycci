"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { InvestmentBreakdownChart } from "@/components/investimentos/breakdown-chart";
import {
  TrendingUp,
  PieChart as PieChartIcon,
  Building2,
  BarChart3,
} from "lucide-react";

interface InvestmentAsset {
  id: string;
  name: string;
  type: string;
  balance: number;
  quantity: number;
  value: number;
  profit: number;
  profitPct: number;
  institution: string;
}

interface InvestimentosData {
  totalInvested: number;
  totalProfit: number;
  byClass: Array<{ type: string; total: number }>;
  byInstitution: Array<{ institution: string; total: number }>;
  assets: InvestmentAsset[];
}

export default function InvestimentosPage() {
  const [data, setData] = useState<InvestimentosData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/investimentos")
      .then((res) => res.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <InvestimentosSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Investimentos</h1>
        <p className="text-sm text-slate-400">Sua carteira de investimentos</p>
      </div>

      {/* Total investido */}
      <Card className="border-slate-800 bg-gradient-to-r from-slate-900 to-blue-950/30">
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-500/10">
            <TrendingUp className="h-7 w-7 text-blue-400" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Valor Atual da Carteira</p>
            <p className="text-3xl font-bold text-white">
              {formatCurrency(data?.totalInvested || 0)}
            </p>
            {(data?.totalProfit ?? 0) !== 0 && (
              <p className={`mt-1 text-sm ${(data?.totalProfit ?? 0) > 0 ? "text-emerald-400" : "text-red-400"}`}>
                {(data?.totalProfit ?? 0) > 0 ? "+" : ""}{formatCurrency(data?.totalProfit ?? 0)} rendimento
              </p>
            )}
            <p className="mt-0.5 text-xs text-slate-500">{data?.assets.length || 0} ativos</p>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos lado a lado */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Por classe */}
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <PieChartIcon className="h-5 w-5 text-slate-400" />
              Por Classe de Ativo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.byClass && data.byClass.length > 0 ? (
              <>
                <InvestmentBreakdownChart
                  data={data.byClass.map((c) => ({ name: c.type, value: c.total }))}
                />
                <div className="mt-4 space-y-2">
                  {data.byClass.map((c) => {
                    const pct = data.totalInvested > 0
                      ? Math.round((c.total / data.totalInvested) * 100)
                      : 0;
                    return (
                      <div key={c.type} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300">{c.type}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500">{pct}%</span>
                          <span className="font-medium text-white">
                            {formatCurrency(c.total)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <EmptyState />
            )}
          </CardContent>
        </Card>

        {/* Por instituição */}
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Building2 className="h-5 w-5 text-slate-400" />
              Por Instituição
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.byInstitution && data.byInstitution.length > 0 ? (
              <>
                <InvestmentBreakdownChart
                  data={data.byInstitution.map((i) => ({
                    name: i.institution,
                    value: i.total,
                  }))}
                />
                <div className="mt-4 space-y-2">
                  {data.byInstitution.map((i) => {
                    const pct = data.totalInvested > 0
                      ? Math.round((i.total / data.totalInvested) * 100)
                      : 0;
                    return (
                      <div key={i.institution} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300">{i.institution}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500">{pct}%</span>
                          <span className="font-medium text-white">
                            {formatCurrency(i.total)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <EmptyState />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela de ativos */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <BarChart3 className="h-5 w-5 text-slate-400" />
            Ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data?.assets && data.assets.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                    <th className="pb-3 font-medium">Nome</th>
                    <th className="hidden pb-3 font-medium sm:table-cell">Tipo</th>
                    <th className="hidden pb-3 font-medium lg:table-cell">Instituição</th>
                    <th className="hidden pb-3 text-right font-medium md:table-cell">Aplicado</th>
                    <th className="pb-3 text-right font-medium">Valor Atual</th>
                    <th className="hidden pb-3 text-right font-medium sm:table-cell">Rent.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.assets.map((asset) => (
                    <tr
                      key={asset.id}
                      className="border-b border-slate-800/50 transition-colors hover:bg-slate-800/30"
                    >
                      <td className="max-w-[180px] truncate py-3 font-medium text-white sm:max-w-[250px]">
                        {asset.name}
                      </td>
                      <td className="hidden py-3 sm:table-cell">
                        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">
                          {asset.type}
                        </span>
                      </td>
                      <td className="hidden py-3 text-slate-400 lg:table-cell">{asset.institution}</td>
                      <td className="hidden py-3 text-right text-slate-300 md:table-cell">
                        {asset.value > 0 ? formatCurrency(asset.value) : "—"}
                      </td>
                      <td className="py-3 text-right font-medium text-emerald-400">
                        {formatCurrency(asset.balance)}
                      </td>
                      <td className={`hidden py-3 text-right font-medium sm:table-cell ${
                        asset.profitPct > 0 ? "text-emerald-400" : asset.profitPct < 0 ? "text-red-400" : "text-slate-400"
                      }`}>
                        {asset.value > 0
                          ? `${asset.profitPct > 0 ? "+" : ""}${asset.profitPct.toFixed(1)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center py-12">
      <TrendingUp className="mb-4 h-12 w-12 text-slate-600" />
      <p className="text-sm text-slate-500">Nenhum investimento encontrado</p>
    </div>
  );
}

function InvestimentosSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-44" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>
      <Skeleton className="h-28 rounded-lg" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}

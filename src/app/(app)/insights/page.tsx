"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UpgradeOverlay } from "@/components/upgrade-overlay";
import { usePlan } from "@/hooks/use-plan";
import { apiFetch } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import {
  Brain, Sparkles, AlertTriangle, Lightbulb, ArrowRight,
  Activity, RefreshCw,
} from "lucide-react";

interface Analysis {
  resumo: string;
  pontos_atencao: string[];
  recomendacoes: string[];
  proximos_passos: string[];
  score_saude: number;
}

interface InsightsData {
  analysis: Analysis;
  generatedAt: string;
  dataSnapshot: {
    saldo: number;
    receitaMensal: number;
    gastoTotal: number;
    creditoUsado: number;
    creditoLimite: number;
    investido: number;
  };
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8 ? "text-emerald-400 bg-emerald-500/10" :
                score >= 5 ? "text-yellow-400 bg-yellow-500/10" :
                "text-red-400 bg-red-500/10";
  const label = score >= 8 ? "Excelente" : score >= 6 ? "Boa" : score >= 4 ? "Regular" : "Atenção";
  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 ${color}`}>
      <Activity className="h-4 w-4" />
      <span className="text-2xl font-bold">{score}</span>
      <span className="text-sm">/10 — {label}</span>
    </div>
  );
}

export default function InsightsPage() {
  const { isPro, loading: planLoading } = usePlan();
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/insights", { method: "POST" });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error || "Erro ao gerar análise");
        return;
      }
      // Garantir que arrays existem mesmo se API retornar incompleto
      const a = json.analysis || {};
      json.analysis = {
        resumo: a.resumo || "",
        pontos_atencao: Array.isArray(a.pontos_atencao) ? a.pontos_atencao : [],
        recomendacoes: Array.isArray(a.recomendacoes) ? a.recomendacoes : [],
        proximos_passos: Array.isArray(a.proximos_passos) ? a.proximos_passos : [],
        score_saude: Number(a.score_saude) || 5,
      };
      setData(json);
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Insights</h1>
          <p className="text-sm text-slate-400">Análise financeira com IA</p>
        </div>
        <UpgradeOverlay feature="Insights com IA" locked={!planLoading && !isPro}>
          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="gap-2 bg-emerald-500 text-slate-950 hover:bg-emerald-400"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Analisando..." : data ? "Atualizar Análise" : "Gerar Análise"}
          </Button>
        </UpgradeOverlay>
      </div>

      {error && (
        <Card className="border-red-800 bg-red-950/30">
          <CardContent className="flex items-center gap-3 p-5">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-lg" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
          </div>
          <Skeleton className="h-40 rounded-lg" />
        </div>
      )}

      {!loading && !data && !error && (
        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="flex flex-col items-center py-16">
            <div className="relative mb-6">
              <Brain className="h-16 w-16 text-slate-600" />
              <Sparkles className="absolute -right-2 -top-2 h-6 w-6 text-emerald-500" />
            </div>
            <h2 className="text-lg font-semibold text-white">Análise com IA</h2>
            <p className="mt-2 max-w-md text-center text-sm text-slate-400">
              Clique em &quot;Gerar Análise&quot; para receber uma avaliação completa da sua saúde financeira com recomendações personalizadas.
            </p>
          </CardContent>
        </Card>
      )}

      {data && !loading && (
        <>
          {/* Score de saúde */}
          <Card className="border-slate-800 bg-slate-900">
            <CardContent className="flex flex-col items-center gap-4 py-8">
              <p className="text-sm text-slate-400">Saúde Financeira</p>
              <ScoreBadge score={data.analysis.score_saude} />
              {data.dataSnapshot && (
                <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-500">
                  <span>Saldo: {formatCurrency(data.dataSnapshot.saldo)}</span>
                  <span>Receita: {formatCurrency(data.dataSnapshot.receitaMensal)}</span>
                  <span>Gastos: {formatCurrency(data.dataSnapshot.gastoTotal)}</span>
                  <span>Investido: {formatCurrency(data.dataSnapshot.investido)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resumo */}
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Brain className="h-5 w-5 text-emerald-400" />
                Resumo Geral
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-slate-300">{data.analysis.resumo}</p>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Pontos de Atenção */}
            <Card className="border-slate-800 bg-slate-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                  Pontos de Atenção
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {data.analysis.pontos_atencao.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Recomendações */}
            <Card className="border-slate-800 bg-slate-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Lightbulb className="h-5 w-5 text-blue-400" />
                  Recomendações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {data.analysis.recomendacoes.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Próximos Passos */}
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <ArrowRight className="h-5 w-5 text-emerald-400" />
                Próximos Passos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {data.analysis.proximos_passos.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-400">
                      {i + 1}
                    </span>
                    {item}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {data.generatedAt && (
            <p className="text-center text-xs text-slate-600">
              Análise gerada em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(data.generatedAt))}
            </p>
          )}
        </>
      )}
    </div>
  );
}

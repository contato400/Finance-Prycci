"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  ShieldCheck,
  AlertTriangle,
  CreditCard,
  Landmark,
  Receipt,
  TrendingDown,
  Save,
} from "lucide-react";

interface LoanData {
  id: string;
  institution_name: string;
  name: string;
  total_amount: number;
  installment_amount: number;
  total_installments: number;
  paid_installments: number;
  outstanding_balance: number;
  interest_rate: number;
}

interface LimitByBank {
  institution: string;
  limit: number;
  used: number;
  available: number;
}

interface ScoreData {
  id: string;
  score: number;
  source: string;
  updated_at: string;
}

interface CreditoData {
  totalLimit: number;
  totalUsed: number;
  totalAvailable: number;
  creditCompromised: number;
  limitsByBank: LimitByBank[];
  loans: LoanData[];
  totalLoanDebt: number;
  score: ScoreData | null;
}

export default function CreditoPage() {
  const [data, setData] = useState<CreditoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoreInput, setScoreInput] = useState("");
  const [savingScore, setSavingScore] = useState(false);

  useEffect(() => {
    fetch("/api/credito")
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        if (json.score) setScoreInput(String(json.score.score));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveScore() {
    const value = parseInt(scoreInput);
    if (isNaN(value) || value < 0 || value > 1000) {
      toast({ title: "Score deve ser entre 0 e 1000", variant: "destructive" });
      return;
    }
    setSavingScore(true);
    try {
      const res = await fetch("/api/credito/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: value }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Score salvo com sucesso!" });
      // Recarregar dados
      const updated = await fetch("/api/credito").then((r) => r.json());
      setData(updated);
    } catch {
      toast({ title: "Erro ao salvar score", variant: "destructive" });
    } finally {
      setSavingScore(false);
    }
  }

  if (loading) return <CreditoSkeleton />;

  const compromised = data?.creditCompromised || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Análise de Crédito</h1>
        <p className="text-sm text-slate-400">Limites, empréstimos e score de crédito</p>
      </div>

      {/* Resumo de crédito */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-slate-400" />
              <p className="text-xs text-slate-500">Limite Total</p>
            </div>
            <p className="mt-2 text-2xl font-bold text-white">
              {formatCurrency(data?.totalLimit || 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <TrendingDown className="h-5 w-5 text-red-400" />
              <p className="text-xs text-slate-500">Total Utilizado</p>
            </div>
            <p className="mt-2 text-2xl font-bold text-red-400">
              {formatCurrency(data?.totalUsed || 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <p className="text-xs text-slate-500">Disponível</p>
            </div>
            <p className="mt-2 text-2xl font-bold text-emerald-400">
              {formatCurrency(data?.totalAvailable || 0)}
            </p>
          </CardContent>
        </Card>
        <Card className={`border-slate-800 ${compromised > 70 ? "bg-red-950/30" : "bg-slate-900"}`}>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              {compromised > 70 ? (
                <AlertTriangle className="h-5 w-5 text-red-400" />
              ) : (
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
              )}
              <p className="text-xs text-slate-500">Comprometido</p>
            </div>
            <p className={`mt-2 text-2xl font-bold ${compromised > 70 ? "text-red-400" : compromised > 50 ? "text-yellow-400" : "text-emerald-400"}`}>
              {compromised}%
            </p>
            <Progress
              value={compromised}
              className={`mt-2 h-1.5 ${
                compromised > 70
                  ? "[&>div]:bg-red-500"
                  : compromised > 50
                    ? "[&>div]:bg-yellow-500"
                    : "[&>div]:bg-emerald-500"
              }`}
            />
          </CardContent>
        </Card>
      </div>

      {/* Alerta de crédito */}
      <Card className={`border-l-4 ${
        compromised > 70
          ? "border-l-red-500 border-slate-800 bg-red-950/20"
          : compromised > 50
            ? "border-l-yellow-500 border-slate-800 bg-yellow-950/20"
            : "border-l-emerald-500 border-slate-800 bg-emerald-950/20"
      }`}>
        <CardContent className="p-5">
          <p className={`text-sm font-medium ${
            compromised > 70 ? "text-red-300" : compromised > 50 ? "text-yellow-300" : "text-emerald-300"
          }`}>
            {compromised > 70
              ? `⚠ Seu crédito está ${compromised}% comprometido. Considere reduzir os gastos no cartão.`
              : compromised > 50
                ? `Atenção: seu crédito está ${compromised}% comprometido. Fique atento aos gastos.`
                : `Seu crédito está ${compromised}% comprometido. Bom controle financeiro!`}
          </p>
        </CardContent>
      </Card>

      {/* Limites por banco */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Landmark className="h-5 w-5" />
            Limites por Banco
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data?.limitsByBank && data.limitsByBank.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                    <th className="pb-3 font-medium">Instituição</th>
                    <th className="pb-3 text-right font-medium">Limite</th>
                    <th className="pb-3 text-right font-medium">Utilizado</th>
                    <th className="pb-3 text-right font-medium">Disponível</th>
                    <th className="pb-3 text-right font-medium">%</th>
                  </tr>
                </thead>
                <tbody>
                  {data.limitsByBank.map((bank) => {
                    const pct = bank.limit > 0 ? Math.round((bank.used / bank.limit) * 100) : 0;
                    return (
                      <tr key={bank.institution} className="border-b border-slate-800/50">
                        <td className="py-3 font-medium text-white">{bank.institution}</td>
                        <td className="py-3 text-right text-slate-300">{formatCurrency(bank.limit)}</td>
                        <td className="py-3 text-right text-red-400">{formatCurrency(bank.used)}</td>
                        <td className="py-3 text-right text-emerald-400">{formatCurrency(bank.available)}</td>
                        <td className="py-3 text-right">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            pct > 80 ? "bg-red-500/10 text-red-400" : pct > 50 ? "bg-yellow-500/10 text-yellow-400" : "bg-emerald-500/10 text-emerald-400"
                          }`}>
                            {pct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">
              Nenhum limite de cartão encontrado
            </p>
          )}
        </CardContent>
      </Card>

      {/* Empréstimos e financiamentos */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-white">
              <Receipt className="h-5 w-5" />
              Empréstimos e Financiamentos
            </CardTitle>
            {data?.totalLoanDebt ? (
              <span className="text-xs text-red-400 sm:text-sm">
                Saldo devedor: {formatCurrency(data.totalLoanDebt)}
              </span>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {data?.loans && data.loans.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                    <th className="pb-3 font-medium">Instituição</th>
                    <th className="hidden pb-3 font-medium sm:table-cell">Produto</th>
                    <th className="hidden pb-3 text-right font-medium md:table-cell">Valor Total</th>
                    <th className="pb-3 text-right font-medium">Parcelas</th>
                    <th className="hidden pb-3 text-right font-medium sm:table-cell">Parcela</th>
                    <th className="pb-3 text-right font-medium">Saldo Devedor</th>
                  </tr>
                </thead>
                <tbody>
                  {data.loans.map((loan) => (
                    <tr key={loan.id} className="border-b border-slate-800/50">
                      <td className="py-3 font-medium text-white">{loan.institution_name}</td>
                      <td className="hidden py-3 text-slate-300 sm:table-cell">{loan.name}</td>
                      <td className="hidden py-3 text-right text-slate-300 md:table-cell">
                        {formatCurrency(loan.total_amount)}
                      </td>
                      <td className="py-3 text-right">
                        <span className="text-emerald-400">{loan.paid_installments}</span>
                        <span className="text-slate-600"> / </span>
                        <span className="text-slate-300">{loan.total_installments}</span>
                      </td>
                      <td className="hidden py-3 text-right text-slate-300 sm:table-cell">
                        {formatCurrency(loan.installment_amount)}
                      </td>
                      <td className="py-3 text-right text-red-400">
                        {formatCurrency(loan.outstanding_balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">
              Nenhum empréstimo ou financiamento ativo
            </p>
          )}
        </CardContent>
      </Card>

      {/* Score de crédito */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <ShieldCheck className="h-5 w-5" />
            Score de Crédito (Serasa)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-6 md:flex-row md:items-end">
            {/* Score visual */}
            <div className="flex flex-col items-center">
              <ScoreGauge score={data?.score?.score || null} />
              {data?.score && (
                <p className="mt-2 text-xs text-slate-500">
                  Atualizado em{" "}
                  {new Intl.DateTimeFormat("pt-BR").format(new Date(data.score.updated_at))}
                </p>
              )}
            </div>

            {/* Input manual */}
            <div className="flex-1 space-y-3">
              <p className="text-sm text-slate-400">
                Insira seu score manualmente (consulte no app Serasa):
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  max="1000"
                  value={scoreInput}
                  onChange={(e) => setScoreInput(e.target.value)}
                  placeholder="Ex: 750"
                  className="w-24 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:w-32"
                />
                <Button
                  onClick={handleSaveScore}
                  disabled={savingScore}
                  size="sm"
                  className="gap-2 bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                >
                  <Save className="h-4 w-4" />
                  {savingScore ? "Salvando..." : "Salvar"}
                </Button>
              </div>
              <ScoreLegend />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Gauge visual do score
function ScoreGauge({ score }: { score: number | null }) {
  const displayScore = score ?? 0;
  const percentage = (displayScore / 1000) * 100;

  const getScoreColor = (s: number) => {
    if (s >= 700) return "text-emerald-400";
    if (s >= 500) return "text-yellow-400";
    if (s >= 300) return "text-orange-400";
    return "text-red-400";
  };

  const getScoreLabel = (s: number) => {
    if (s >= 700) return "Excelente";
    if (s >= 500) return "Bom";
    if (s >= 300) return "Regular";
    if (s > 0) return "Baixo";
    return "—";
  };

  const getStrokeDash = (pct: number) => {
    const circumference = 2 * Math.PI * 60; // raio 60
    const filled = (pct / 100) * (circumference * 0.75); // 270 graus = 75% do círculo
    return `${filled} ${circumference}`;
  };

  const getStrokeColor = (s: number) => {
    if (s >= 700) return "#10b981";
    if (s >= 500) return "#eab308";
    if (s >= 300) return "#f97316";
    return "#ef4444";
  };

  return (
    <div className="relative flex flex-col items-center">
      <svg width="160" height="130" viewBox="0 0 160 140">
        {/* Fundo do arco */}
        <path
          d="M 20 120 A 60 60 0 1 1 140 120"
          fill="none"
          stroke="#1e293b"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Arco preenchido */}
        {score !== null && (
          <path
            d="M 20 120 A 60 60 0 1 1 140 120"
            fill="none"
            stroke={getStrokeColor(displayScore)}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={getStrokeDash(percentage)}
            className="transition-all duration-1000"
          />
        )}
        {/* Texto central */}
        <text x="80" y="90" textAnchor="middle" className="fill-white text-3xl font-bold" fontSize="32">
          {score !== null ? displayScore : "—"}
        </text>
        <text x="80" y="115" textAnchor="middle" className="fill-slate-400" fontSize="12">
          {getScoreLabel(displayScore)}
        </text>
      </svg>
      <p className={`text-sm font-medium ${score !== null ? getScoreColor(displayScore) : "text-slate-500"}`}>
        de 1000 pontos
      </p>
    </div>
  );
}

// Legenda das faixas de score
function ScoreLegend() {
  const ranges = [
    { label: "0-300", color: "bg-red-500", text: "Baixo" },
    { label: "300-500", color: "bg-orange-500", text: "Regular" },
    { label: "500-700", color: "bg-yellow-500", text: "Bom" },
    { label: "700-1000", color: "bg-emerald-500", text: "Excelente" },
  ];
  return (
    <div className="flex flex-wrap gap-3">
      {ranges.map((r) => (
        <div key={r.label} className="flex items-center gap-1.5">
          <div className={`h-2.5 w-2.5 rounded-full ${r.color}`} />
          <span className="text-xs text-slate-500">
            {r.label} ({r.text})
          </span>
        </div>
      ))}
    </div>
  );
}

function CreditoSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-16 rounded-lg" />
      <Skeleton className="h-48 rounded-lg" />
      <Skeleton className="h-48 rounded-lg" />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}

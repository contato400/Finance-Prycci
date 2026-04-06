"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { BankAvatar } from "@/components/bank-avatar";
import { formatCurrency } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { ResponsiveContainer, RadialBarChart, RadialBar } from "recharts";
import { ShieldCheck, Calculator, CreditCard, Sparkles, RefreshCw } from "lucide-react";

interface ScoreData {
  score: number; label: string; color: string;
  breakdown: { renda: number; comprometimento: number; credito: number; regularidade: number; diversificacao: number };
  capacidade: { rendaMedia: number; gastosMedios: number; disponivelMensal: number; parcelaMaxSugerida: number; credito12x: number; credito24x: number; credito36x: number };
  creditUsed: number; creditLimit: number;
}

interface CardByBank { name: string; institution: string; limit: number; used: number; available: number; }

const BANK_RATES: Record<string, number> = {
  "Nubank": 1.99, "Banco Inter": 1.89, "Caixa Econômica Federal": 0.75,
  "Nubank Empresas": 1.99, "Bradesco": 2.49, "Itaú": 2.29, "Santander": 2.39,
};

const COLOR_MAP: Record<string, string> = { green: "#10b981", yellow: "#eab308", orange: "#f97316", red: "#ef4444" };

export default function CreditoPage() {
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [cards, setCards] = useState<CardByBank[]>([]);
  const [loading, setLoading] = useState(true);
  // Simulador
  const [simValor, setSimValor] = useState(10000);
  const [simPrazo, setSimPrazo] = useState(24);
  const [simBanco, setSimBanco] = useState("");
  const [simTaxa, setSimTaxa] = useState(1.99);
  // IA
  const [analiseIA, setAnaliseIA] = useState("");
  const [loadingIA, setLoadingIA] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/credit/score").then((r) => r.json()),
      apiFetch("/api/cartoes").then((r) => r.json()),
    ]).then(([score, cartoes]) => {
      setScoreData(score);
      if (cartoes.cards) {
        setCards(cartoes.cards.map((c: { name: string; accounts?: { pluggy_items?: { institution_name: string } }; credit_limit: number; balance: number; available_limit: number }) => ({
          name: c.name,
          institution: c.accounts?.pluggy_items?.institution_name || "Desconhecido",
          limit: c.credit_limit,
          used: c.balance,
          available: c.available_limit,
        })));
        // Setar banco padrão no simulador
        const firstBank = cartoes.cards[0]?.accounts?.pluggy_items?.institution_name;
        if (firstBank) { setSimBanco(firstBank); setSimTaxa(BANK_RATES[firstBank] || 1.99); }
      }
    }).finally(() => setLoading(false));
  }, []);

  // Simulador Price
  const taxaMensal = simTaxa / 100;
  const parcela = taxaMensal > 0
    ? simValor * (taxaMensal * Math.pow(1 + taxaMensal, simPrazo)) / (Math.pow(1 + taxaMensal, simPrazo) - 1)
    : simValor / simPrazo;
  const totalPago = parcela * simPrazo;
  const totalJuros = totalPago - simValor;
  const parcelaPercRenda = scoreData?.capacidade.rendaMedia ? Math.round((parcela / scoreData.capacidade.rendaMedia) * 100) : 0;

  async function gerarAnaliseIA() {
    setLoadingIA(true);
    try {
      const res = await apiFetch("/api/credit/ai-analysis", { method: "POST" });
      const json = await res.json();
      setAnaliseIA(json.analise || "Análise indisponível.");
    } catch { setAnaliseIA("Erro ao gerar análise."); }
    finally { setLoadingIA(false); }
  }

  // Auto-gerar análise da IA ao carregar
  useEffect(() => {
    if (!loading && scoreData && !analiseIA) gerarAnaliseIA();
  }, [loading, scoreData]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <CreditoSkeleton />;
  const s = scoreData;
  const b = s?.breakdown;
  const c = s?.capacidade;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Análise de Crédito</h1>
        <p className="text-sm text-slate-400">Score, capacidade e simulador</p>
      </div>

      {/* SCORE */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader><CardTitle className="flex items-center gap-2 text-white"><ShieldCheck className="h-5 w-5 text-emerald-400" />Score Prycci</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <ScoreGauge score={s?.score ?? 0} color={s?.color ?? "red"} label={s?.label ?? ""} />
            <div className="flex-1 space-y-3">
              <ScoreBar name="Renda Mensal" value={b?.renda ?? 0} max={200} />
              <ScoreBar name="Comprometimento" value={b?.comprometimento ?? 0} max={200} />
              <ScoreBar name="Uso do Crédito" value={b?.credito ?? 0} max={200} />
              <ScoreBar name="Regularidade" value={b?.regularidade ?? 0} max={200} />
              <ScoreBar name="Diversificação" value={b?.diversificacao ?? 0} max={200} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CAPACIDADE */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Renda Média" value={formatCurrency(c?.rendaMedia ?? 0)} color="text-emerald-400" />
        <MetricCard label="Disponível Mensal" value={formatCurrency(c?.disponivelMensal ?? 0)} color="text-white" />
        <MetricCard label="Parcela Máx. Sugerida" value={formatCurrency(c?.parcelaMaxSugerida ?? 0)} sub="30% do disponível" color="text-emerald-400" />
      </div>
      <Card className="border-slate-800 bg-slate-900">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-800 text-left text-xs text-slate-500"><th className="p-3">Prazo</th><th className="p-3 text-right">Crédito Máximo</th><th className="p-3 text-right">Parcela</th></tr></thead>
            <tbody>
              {[{ p: 12, v: c?.credito12x }, { p: 24, v: c?.credito24x }, { p: 36, v: c?.credito36x }].map(({ p, v }) => (
                <tr key={p} className={`border-b border-slate-800/50 ${p === 24 ? "bg-emerald-500/5" : ""}`}>
                  <td className="p-3 text-white">{p}x {p === 24 && <span className="ml-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-400">recomendado</span>}</td>
                  <td className="p-3 text-right font-medium text-white">{formatCurrency(v ?? 0)}</td>
                  <td className="p-3 text-right text-slate-400">{formatCurrency(c?.parcelaMaxSugerida ?? 0)}/mês</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* SIMULADOR */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Calculator className="h-5 w-5" />Simulador de Financiamento</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs text-slate-400"><span>Valor</span><span>{formatCurrency(simValor)}</span></div>
                <input type="range" min={1000} max={200000} step={1000} value={simValor} onChange={(e) => setSimValor(Number(e.target.value))} className="mt-1 w-full accent-emerald-500" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-400"><span>Prazo</span><span>{simPrazo} meses</span></div>
                <input type="range" min={12} max={60} value={simPrazo} onChange={(e) => setSimPrazo(Number(e.target.value))} className="mt-1 w-full accent-emerald-500" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-400"><span>Banco</span><span>{simTaxa.toFixed(2)}% a.m.</span></div>
                <select value={simBanco} onChange={(e) => { setSimBanco(e.target.value); setSimTaxa(BANK_RATES[e.target.value] || 1.99); }} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">
                  {Array.from(new Set(cards.map((cd) => cd.institution))).map((inst) => (
                    <option key={inst} value={inst}>{inst} ({(BANK_RATES[inst] || 1.99).toFixed(2)}%)</option>
                  ))}
                  <option value="custom">Personalizado</option>
                </select>
                {simBanco === "custom" && (
                  <input type="number" step={0.01} min={0.1} max={10} value={simTaxa} onChange={(e) => setSimTaxa(Number(e.target.value))} className="mt-2 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" placeholder="Taxa % a.m." />
                )}
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                <p className="text-xs text-slate-500">Parcela mensal</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(parcela)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-800 p-3"><p className="text-xs text-slate-500">Total</p><p className="text-sm font-bold text-white">{formatCurrency(totalPago)}</p></div>
                <div className="rounded-lg border border-slate-800 p-3"><p className="text-xs text-slate-500">Juros</p><p className="text-sm font-bold text-red-400">{formatCurrency(totalJuros)}</p></div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border p-3" style={{ borderColor: parcelaPercRenda > 30 ? "#ef4444" : parcelaPercRenda > 20 ? "#eab308" : "#10b981" }}>
                <div className={`h-3 w-3 rounded-full ${parcelaPercRenda > 30 ? "bg-red-500" : parcelaPercRenda > 20 ? "bg-yellow-500" : "bg-emerald-500"}`} />
                <span className="text-xs text-slate-300">{parcelaPercRenda}% da sua renda mensal</span>
              </div>
              {/* Comparativo entre bancos */}
              {cards.length > 1 && (
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500">Comparativo para {formatCurrency(simValor)} em {simPrazo}x:</p>
                  {Array.from(new Set(cards.map((cd) => cd.institution))).map((inst) => {
                    const t = (BANK_RATES[inst] || 1.99) / 100;
                    const p = t > 0 ? simValor * (t * Math.pow(1 + t, simPrazo)) / (Math.pow(1 + t, simPrazo) - 1) : simValor / simPrazo;
                    return (
                      <div key={inst} className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">{inst}</span>
                        <span className={`font-medium ${inst === simBanco ? "text-emerald-400" : "text-slate-300"}`}>{formatCurrency(p)}/mês</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LIMITES POR BANCO */}
      {cards.length > 0 && (
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader><CardTitle className="flex items-center gap-2 text-white"><CreditCard className="h-5 w-5" />Limites por Banco</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {cards.map((card, i) => {
              const pct = card.limit > 0 ? Math.round((card.used / card.limit) * 100) : 0;
              return (
                <div key={i} className="rounded-lg border border-slate-800 p-4">
                  <div className="flex items-center gap-3">
                    <BankAvatar bankName={card.institution} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{card.institution}</p>
                      <p className="text-xs text-slate-500">{card.name}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${pct > 80 ? "bg-red-500/10 text-red-400" : pct > 50 ? "bg-yellow-500/10 text-yellow-400" : "bg-emerald-500/10 text-emerald-400"}`}>{pct}%</span>
                  </div>
                  <Progress value={pct} className={`mt-3 h-1.5 ${pct > 80 ? "[&>div]:bg-red-500" : pct > 50 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-emerald-500"}`} />
                  <div className="mt-2 flex justify-between text-xs text-slate-500">
                    <span>Usado: <span className="text-red-400">{formatCurrency(card.used)}</span></span>
                    <span>Limite: {formatCurrency(card.limit)}</span>
                    <span>Disponível: <span className="text-emerald-400">{formatCurrency(card.available)}</span></span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ANÁLISE IA */}
      <Card className="border-l-4 border-l-emerald-500 border-slate-800 bg-slate-900">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-white"><Sparkles className="h-5 w-5 text-emerald-400" />Análise da IA</CardTitle>
            <Button onClick={gerarAnaliseIA} disabled={loadingIA} size="sm" variant="outline" className="gap-1 border-slate-700 text-xs text-slate-300">
              {loadingIA ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {loadingIA ? "Analisando..." : "Atualizar"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {analiseIA ? (
            <div className="space-y-3 text-sm leading-relaxed text-slate-300">
              {analiseIA.split(/\n\n|\n/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Clique em &quot;Atualizar&quot; para gerar uma análise personalizada sobre seu crédito.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Sub-components ---

function ScoreGauge({ score, color, label }: { score: number; color: string; label: string }) {
  const hex = COLOR_MAP[color] || "#ef4444";
  const gaugeData = [{ name: "score", value: (score / 1000) * 100, fill: hex }];
  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width={180} height={180}>
        <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" startAngle={180} endAngle={0} data={gaugeData} barSize={14}>
          <RadialBar dataKey="value" cornerRadius={10} background={{ fill: "#1e293b" }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="-mt-16 text-center">
        <span className="text-4xl font-bold text-white">{score}</span>
        <span className="text-sm text-slate-400">/1000</span>
        <p className="text-xs font-medium" style={{ color: hex }}>{label}</p>
      </div>
    </div>
  );
}

function ScoreBar({ name, value, max }: { name: string; value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  const color = pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-yellow-500" : pct >= 25 ? "bg-orange-500" : "bg-red-500";
  return (
    <div>
      <div className="flex items-center justify-between text-xs"><span className="text-slate-400">{name}</span><span className="text-slate-500">{value}/{max}</span></div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function MetricCard({ label, value, color = "text-white", sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardContent className="p-4">
        <p className="text-xs text-slate-500">{label}</p>
        <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
        {sub && <p className="text-[10px] text-slate-600">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function CreditoSkeleton() {
  return (
    <div className="space-y-6">
      <div><Skeleton className="h-8 w-48" /><Skeleton className="mt-2 h-4 w-64" /></div>
      <Skeleton className="h-64 rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
      <Skeleton className="h-64 rounded-lg" />
      <Skeleton className="h-48 rounded-lg" />
    </div>
  );
}

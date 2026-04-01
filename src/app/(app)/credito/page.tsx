"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { BankAvatar } from "@/components/bank-avatar";
import { UpgradeOverlay } from "@/components/upgrade-overlay";
import { usePlan } from "@/hooks/use-plan";
import { toast } from "@/hooks/use-toast";
import {
  ShieldCheck, AlertTriangle, CreditCard, Calculator, Search,
  Plus, ArrowUpRight, Wallet,
} from "lucide-react";

// --- Types ---
interface ScoreBreakdown {
  total: number;
  income: { score: number; avgIncome: number };
  commitment: { score: number; ratio: number };
  creditUsage: { score: number; ratio: number };
  regularity: { score: number; monthsPaid: number };
  diversification: { score: number; investments: number; banks: number; balance: number };
}

interface LoanCapacity {
  avgIncome: number; avgExpense: number; disponivel: number; parcelaMax: number;
  credito12x: number; credito24x: number; credito36x: number;
}

interface CardByBank {
  name: string; institution: string; limit: number; used: number; available: number;
}

interface CreditoData {
  scoreBreakdown: ScoreBreakdown;
  loanCapacity: LoanCapacity;
  cardsByBank: CardByBank[];
  totalCreditLimit: number; totalCreditUsed: number; totalCreditAvailable: number;
  loans: Array<{ id: string; institution_name: string; name: string; total_amount: number; total_installments: number; paid_installments: number; outstanding_balance: number }>;
  totalLoanDebt: number;
  cpfConsultations: Array<{ id: string; consulted_at: string; institution: string; type: string }>;
  recentCpfCount: number;
}

export default function CreditoPage() {
  const [data, setData] = useState<CreditoData | null>(null);
  const [loading, setLoading] = useState(true);
  // Simulador
  const [simValor, setSimValor] = useState(10000);
  const [simPrazo, setSimPrazo] = useState(24);
  const [simTaxa, setSimTaxa] = useState(1.99);
  const { isPro, loading: planLoading } = usePlan();
  // CPF
  const [cpfInst, setCpfInst] = useState("");
  const [cpfType, setCpfType] = useState("Consulta de crédito");
  const [cpfDate, setCpfDate] = useState(new Date().toISOString().split("T")[0]);
  const [savingCpf, setSavingCpf] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/credito");
      setData(await res.json());
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Simulador Price
  const taxaMensal = simTaxa / 100;
  const parcela = taxaMensal > 0
    ? simValor * (taxaMensal * Math.pow(1 + taxaMensal, simPrazo)) / (Math.pow(1 + taxaMensal, simPrazo) - 1)
    : simValor / simPrazo;
  const totalPago = parcela * simPrazo;
  const totalJuros = totalPago - simValor;
  const parcelaPercRenda = data?.loanCapacity.avgIncome ? Math.round((parcela / data.loanCapacity.avgIncome) * 100) : 0;

  async function handleSaveCpf() {
    if (!cpfInst.trim()) { toast({ title: "Informe a instituição", variant: "destructive" }); return; }
    setSavingCpf(true);
    try {
      const res = await apiFetch("/api/credito/cpf", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institution: cpfInst, type: cpfType, consulted_at: cpfDate }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Consulta registrada!" });
      setCpfInst("");
      fetchData();
    } catch { toast({ title: "Erro ao salvar", variant: "destructive" }); }
    finally { setSavingCpf(false); }
  }

  if (loading) return <CreditoSkeleton />;
  const s = data?.scoreBreakdown;
  const lc = data?.loanCapacity;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Análise de Crédito</h1>
        <p className="text-sm text-slate-400">Score, capacidade, simulador e cartões</p>
      </div>

      {/* ═══ SEÇÃO 1: Score FinanceOS ═══ */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader><CardTitle className="flex items-center gap-2 text-white"><ShieldCheck className="h-5 w-5" />Score FinanceOS</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
            <ScoreGauge score={s?.total ?? 0} />
            <div className="flex-1 space-y-3">
              <ScoreBar label="Renda mensal" score={s?.income.score ?? 0} detail={`Média: ${formatCurrency(s?.income.avgIncome ?? 0)}`} />
              <ScoreBar label="Comprometimento" score={s?.commitment.score ?? 0} detail={`${s?.commitment.ratio ?? 0}% da renda`} />
              <ScoreBar label="Uso do crédito" score={s?.creditUsage.score ?? 0} detail={`${s?.creditUsage.ratio ?? 0}% do limite`} />
              <ScoreBar label="Regularidade" score={s?.regularity.score ?? 0} detail={`${s?.regularity.monthsPaid ?? 0}/3 meses`} />
              <ScoreBar label="Diversificação" score={s?.diversification.score ?? 0} detail={`${s?.diversification.banks ?? 0} bancos, ${formatCurrency(s?.diversification.investments ?? 0)} investidos`} />
              <ScoreLegend />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ SEÇÃO 2: Capacidade de Empréstimo ═══ */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Wallet className="h-5 w-5" />Capacidade de Empréstimo</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-center">
              <p className="text-xs text-slate-500">Renda média</p>
              <p className="mt-1 text-xl font-bold text-emerald-400">{formatCurrency(lc?.avgIncome ?? 0)}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-center">
              <p className="text-xs text-slate-500">Gastos médios</p>
              <p className="mt-1 text-xl font-bold text-red-400">{formatCurrency(lc?.avgExpense ?? 0)}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-center">
              <p className="text-xs text-slate-500">Parcela máx. sugerida</p>
              <p className="mt-1 text-xl font-bold text-white">{formatCurrency(lc?.parcelaMax ?? 0)}</p>
              <p className="text-[10px] text-slate-600">30% do disponível</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Crédito 12x", value: lc?.credito12x ?? 0 },
              { label: "Crédito 24x", value: lc?.credito24x ?? 0 },
              { label: "Crédito 36x", value: lc?.credito36x ?? 0 },
            ].map((c) => (
              <div key={c.label} className="flex items-center justify-between rounded-lg border border-slate-800 px-4 py-3">
                <span className="text-sm text-slate-400">{c.label}</span>
                <span className="text-sm font-bold text-white">{formatCurrency(c.value)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ═══ SEÇÃO 3: Simulador de Financiamento ═══ */}
      <UpgradeOverlay feature="Simulador de Financiamento" locked={!planLoading && !isPro}>
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Calculator className="h-5 w-5" />Simulador de Financiamento</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400">Valor desejado: {formatCurrency(simValor)}</label>
                <input type="range" min={1000} max={200000} step={1000} value={simValor} onChange={(e) => setSimValor(Number(e.target.value))}
                  className="mt-1 w-full accent-emerald-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Prazo: {simPrazo} meses</label>
                <input type="range" min={12} max={60} step={1} value={simPrazo} onChange={(e) => setSimPrazo(Number(e.target.value))}
                  className="mt-1 w-full accent-emerald-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Taxa de juros: {simTaxa.toFixed(2)}% a.m.</label>
                <input type="range" min={0.5} max={5} step={0.01} value={simTaxa} onChange={(e) => setSimTaxa(Number(e.target.value))}
                  className="mt-1 w-full accent-emerald-500" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                <p className="text-xs text-slate-500">Parcela mensal</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(parcela)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-800 p-3">
                  <p className="text-xs text-slate-500">Total pago</p>
                  <p className="text-sm font-bold text-white">{formatCurrency(totalPago)}</p>
                </div>
                <div className="rounded-lg border border-slate-800 p-3">
                  <p className="text-xs text-slate-500">Juros</p>
                  <p className="text-sm font-bold text-red-400">{formatCurrency(totalJuros)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border p-3" style={{
                borderColor: parcelaPercRenda > 30 ? "#ef4444" : parcelaPercRenda > 20 ? "#eab308" : "#10b981",
              }}>
                <div className={`h-3 w-3 rounded-full ${parcelaPercRenda > 30 ? "bg-red-500" : parcelaPercRenda > 20 ? "bg-yellow-500" : "bg-emerald-500"}`} />
                <span className="text-xs text-slate-300">{parcelaPercRenda}% da sua renda mensal</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </UpgradeOverlay>

      {/* ═══ SEÇÃO 4: Cartões de Crédito ═══ */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader><CardTitle className="flex items-center gap-2 text-white"><CreditCard className="h-5 w-5" />Limites por Banco</CardTitle></CardHeader>
        <CardContent>
          {data?.cardsByBank && data.cardsByBank.length > 0 ? (
            <div className="space-y-3">
              {data.cardsByBank.map((card) => {
                const pct = card.limit > 0 ? Math.round((card.used / card.limit) * 100) : 0;
                return (
                  <div key={card.name} className="rounded-lg border border-slate-800 p-4">
                    <div className="flex items-center gap-3">
                      <BankAvatar bankName={card.institution} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{card.institution}</p>
                        <p className="text-xs text-slate-500">{card.name}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        pct > 80 ? "bg-red-500/10 text-red-400" : pct > 50 ? "bg-yellow-500/10 text-yellow-400" : "bg-emerald-500/10 text-emerald-400"
                      }`}>{pct}%</span>
                    </div>
                    <Progress value={pct} className={`mt-3 h-1.5 ${
                      pct > 80 ? "[&>div]:bg-red-500" : pct > 50 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-emerald-500"
                    }`} />
                    <div className="mt-2 flex justify-between text-xs text-slate-500">
                      <span>Usado: <span className="text-red-400">{formatCurrency(card.used)}</span></span>
                      <span>Limite: {formatCurrency(card.limit)}</span>
                      <span>Disponível: <span className="text-emerald-400">{formatCurrency(card.available)}</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="py-8 text-center text-sm text-slate-500">Nenhum cartão com limite encontrado</p>}
        </CardContent>
      </Card>

      {/* ═══ SEÇÃO 5: Consultas CPF ═══ */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Search className="h-5 w-5" />Consultas ao CPF</CardTitle></CardHeader>
        <CardContent>
          {(data?.recentCpfCount ?? 0) >= 3 && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-800 bg-red-950/20 p-3">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <p className="text-xs text-red-300">{data?.recentCpfCount} consultas nos últimos 30 dias — pode impactar seu score.</p>
            </div>
          )}
          <div className="mb-4 flex flex-wrap gap-2">
            <input value={cpfInst} onChange={(e) => setCpfInst(e.target.value)} placeholder="Instituição"
              className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none" />
            <select value={cpfType} onChange={(e) => setCpfType(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none">
              <option>Consulta de crédito</option><option>Empréstimo</option><option>Cartão de crédito</option><option>Financiamento</option><option>Outro</option>
            </select>
            <input type="date" value={cpfDate} onChange={(e) => setCpfDate(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none" />
            <Button onClick={handleSaveCpf} disabled={savingCpf} size="sm" className="gap-1 bg-emerald-500 text-slate-950 hover:bg-emerald-400">
              <Plus className="h-4 w-4" />Registrar
            </Button>
          </div>
          {data?.cpfConsultations && data.cpfConsultations.length > 0 ? (
            <div className="space-y-2">
              {data.cpfConsultations.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-800 px-4 py-2">
                  <div className="flex items-center gap-3">
                    <ArrowUpRight className="h-4 w-4 text-yellow-400" />
                    <div>
                      <p className="text-sm text-white">{c.institution}</p>
                      <p className="text-xs text-slate-500">{c.type}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">{c.consulted_at}</p>
                </div>
              ))}
            </div>
          ) : <p className="py-4 text-center text-sm text-slate-500">Nenhuma consulta registrada</p>}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Subcomponents ---

function ScoreGauge({ score }: { score: number }) {
  const pct = (score / 1000) * 100;
  const color = score >= 700 ? "#10b981" : score >= 500 ? "#eab308" : score >= 300 ? "#f97316" : "#ef4444";
  const label = score >= 700 ? "Excelente" : score >= 500 ? "Bom" : score >= 300 ? "Regular" : "Baixo";
  const dash = `${(pct / 100) * (2 * Math.PI * 60 * 0.75)} ${2 * Math.PI * 60}`;
  return (
    <div className="flex flex-col items-center">
      <svg width="180" height="140" viewBox="0 0 180 150">
        <path d="M 25 130 A 65 65 0 1 1 155 130" fill="none" stroke="#1e293b" strokeWidth="14" strokeLinecap="round" />
        <path d="M 25 130 A 65 65 0 1 1 155 130" fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" strokeDasharray={dash} className="transition-all duration-1000" />
        <text x="90" y="95" textAnchor="middle" className="fill-white font-bold" fontSize="36">{score}</text>
        <text x="90" y="120" textAnchor="middle" className="fill-slate-400" fontSize="13">{label}</text>
      </svg>
      <p className="text-sm text-slate-500">de 1000 pontos</p>
    </div>
  );
}

function ScoreBar({ label, score, detail }: { label: string; score: number; detail: string }) {
  const pct = (score / 200) * 100;
  const color = pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-yellow-500" : pct >= 25 ? "bg-orange-500" : "bg-red-500";
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-500">{score}/200 — {detail}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ScoreLegend() {
  return (
    <div className="mt-3 flex flex-wrap gap-3">
      {[{ l: "0-300", c: "bg-red-500", t: "Baixo" }, { l: "300-500", c: "bg-orange-500", t: "Regular" }, { l: "500-700", c: "bg-yellow-500", t: "Bom" }, { l: "700-1000", c: "bg-emerald-500", t: "Excelente" }].map((r) => (
        <div key={r.l} className="flex items-center gap-1.5"><div className={`h-2.5 w-2.5 rounded-full ${r.c}`} /><span className="text-xs text-slate-500">{r.l} ({r.t})</span></div>
      ))}
    </div>
  );
}

function CreditoSkeleton() {
  return (
    <div className="space-y-6">
      <div><Skeleton className="h-8 w-48" /><Skeleton className="mt-2 h-4 w-64" /></div>
      <Skeleton className="h-72 rounded-lg" />
      <Skeleton className="h-48 rounded-lg" />
      <Skeleton className="h-64 rounded-lg" />
      <Skeleton className="h-48 rounded-lg" />
      <Skeleton className="h-40 rounded-lg" />
    </div>
  );
}

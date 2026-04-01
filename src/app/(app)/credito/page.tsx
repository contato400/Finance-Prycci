"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { useDateRange } from "@/contexts/date-range-context";
import { toast } from "@/hooks/use-toast";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from "recharts";
import {
  ShieldCheck, AlertTriangle, CreditCard, Landmark, Receipt,
  TrendingDown, Save, Plus, Search, ArrowUpRight,
} from "lucide-react";

// --- Types ---

interface CreditoData {
  totalLimit: number; totalUsed: number; totalAvailable: number; creditCompromised: number;
  limitsByBank: Array<{ institution: string; limit: number; used: number; available: number }>;
  loans: Array<{ id: string; institution_name: string; name: string; total_amount: number; installment_amount: number; total_installments: number; paid_installments: number; outstanding_balance: number }>;
  totalLoanDebt: number;
  score: { score: number; source: string; updated_at: string } | null;
  periodSpent: number; periodTxCount: number; avgUsage: number;
  biggestTransaction: { description: string; amount: number; date: string } | null;
  usageChart: Array<{ date: string; spent: number; accumulated: number; usagePercent: number }>;
  topCategories: Array<{ category: string; total: number; count: number; percent: number }>;
  scoreHistory: Array<{ score: number; recorded_at: string }>;
  cpfConsultations: Array<{ id: string; consulted_at: string; institution: string; type: string }>;
  hasRecentCpfConsult: boolean;
}

const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

function num(v: unknown): number { const n = Number(v); return isNaN(n) ? 0 : n; }

// --- Page ---

export default function CreditoPage() {
  const [data, setData] = useState<CreditoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoreInput, setScoreInput] = useState("");
  const [savingScore, setSavingScore] = useState(false);
  const [cpfInst, setCpfInst] = useState("");
  const [cpfType, setCpfType] = useState("Consulta de crédito");
  const [savingCpf, setSavingCpf] = useState(false);
  const { startStr, endStr, label: periodLabel } = useDateRange();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/credito?start=${startStr}&end=${endStr}`);
      const json = await res.json();
      setData(json);
      if (json.score) setScoreInput(String(json.score.score));
    } catch { /* */ }
    finally { setLoading(false); }
  }, [startStr, endStr]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSaveScore() {
    const value = parseInt(scoreInput);
    if (isNaN(value) || value < 0 || value > 1000) {
      toast({ title: "Score deve ser entre 0 e 1000", variant: "destructive" }); return;
    }
    setSavingScore(true);
    try {
      const res = await apiFetch("/api/credito/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ score: value }) });
      if (!res.ok) throw new Error();
      toast({ title: "Score registrado!" });
      fetchData();
    } catch { toast({ title: "Erro ao salvar", variant: "destructive" }); }
    finally { setSavingScore(false); }
  }

  async function handleSaveCpf() {
    if (!cpfInst.trim()) { toast({ title: "Informe a instituição", variant: "destructive" }); return; }
    setSavingCpf(true);
    try {
      const res = await apiFetch("/api/credito/cpf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ institution: cpfInst, type: cpfType }) });
      if (!res.ok) throw new Error();
      toast({ title: "Consulta registrada!" });
      setCpfInst("");
      fetchData();
    } catch { toast({ title: "Erro ao salvar", variant: "destructive" }); }
    finally { setSavingCpf(false); }
  }

  if (loading) return <CreditoSkeleton />;
  const d = data;
  const compromised = d?.creditCompromised ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Análise de Crédito</h1>
        <p className="text-sm text-slate-400">Limites, gastos e score • {periodLabel}</p>
      </div>

      {/* ── Cards de resumo atuais ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniCard icon={<CreditCard className="h-5 w-5 text-slate-400" />} label="Limite Total" value={formatCurrency(d?.totalLimit ?? 0)} />
        <MiniCard icon={<TrendingDown className="h-5 w-5 text-red-400" />} label="Utilizado" value={formatCurrency(d?.totalUsed ?? 0)} color="text-red-400" />
        <MiniCard icon={<ShieldCheck className="h-5 w-5 text-emerald-400" />} label="Disponível" value={formatCurrency(d?.totalAvailable ?? 0)} color="text-emerald-400" />
        <Card className={`border-slate-800 ${compromised > 70 ? "bg-red-950/30" : "bg-slate-900"}`}>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              {compromised > 70 ? <AlertTriangle className="h-5 w-5 text-red-400" /> : <ShieldCheck className="h-5 w-5 text-emerald-400" />}
              <p className="text-xs text-slate-500">Comprometido</p>
            </div>
            <p className={`mt-2 text-2xl font-bold ${compromised > 70 ? "text-red-400" : compromised > 50 ? "text-yellow-400" : "text-emerald-400"}`}>{compromised}%</p>
            <Progress value={compromised} className={`mt-2 h-1.5 ${compromised > 70 ? "[&>div]:bg-red-500" : compromised > 50 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-emerald-500"}`} />
          </CardContent>
        </Card>
      </div>

      {/* ── Cards do período ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">Gasto no crédito • {periodLabel}</p>
            <p className="mt-1 text-2xl font-bold text-red-400">{formatCurrency(d?.periodSpent ?? 0)}</p>
            <p className="mt-1 text-xs text-slate-600">{d?.periodTxCount ?? 0} transações</p>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">Utilização média do limite</p>
            <p className="mt-1 text-2xl font-bold text-white">{d?.avgUsage ?? 0}%</p>
            <p className="mt-1 text-xs text-slate-600">do limite total no período</p>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">Maior gasto único</p>
            {d?.biggestTransaction ? (
              <>
                <p className="mt-1 text-2xl font-bold text-white">{formatCurrency(d.biggestTransaction.amount)}</p>
                <p className="mt-1 truncate text-xs text-slate-600">{d.biggestTransaction.description}</p>
              </>
            ) : <p className="mt-1 text-lg text-slate-600">—</p>}
          </CardContent>
        </Card>
      </div>

      {/* ── Gráfico de utilização ── */}
      {d?.usageChart && d.usageChart.length > 1 && (
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader><CardTitle className="text-white">Utilização de Crédito • {periodLabel}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={d.usageChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickFormatter={(v: string) => { const p = v.split("-"); return `${p[2]}/${p[1]}`; }} interval="preserveStartEnd" />
                <YAxis stroke="#64748b" fontSize={11} unit="%" width={50} />
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", color: "#f8fafc" }} formatter={(v) => [`${v}%`, "Uso do limite"]} labelFormatter={(l) => { const p = String(l).split("-"); return `${p[2]}/${p[1]}/${p[0]}`; }} />
                <Line type="monotone" dataKey="usagePercent" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── Top categorias (PieChart) ── */}
      {d?.topCategories && d.topCategories.length > 0 && (
        <Card className="border-slate-800 bg-slate-900">
          <CardHeader><CardTitle className="text-white">Top Categorias de Crédito • {periodLabel}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={d.topCategories} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="total" nameKey="category">
                    {d.topCategories.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", color: "#f8fafc" }} formatter={(v) => [formatCurrency(num(v)), "Total"]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {d.topCategories.map((c, i) => (
                  <div key={c.category} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-slate-300">{c.category}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium text-white">{formatCurrency(c.total)}</span>
                      <span className="ml-2 text-xs text-slate-500">{c.percent}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Limites por banco ── */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Landmark className="h-5 w-5" />Limites por Banco</CardTitle></CardHeader>
        <CardContent>
          {d?.limitsByBank && d.limitsByBank.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                  <th className="pb-3 font-medium">Instituição</th>
                  <th className="pb-3 text-right font-medium">Limite</th>
                  <th className="pb-3 text-right font-medium">Utilizado</th>
                  <th className="hidden pb-3 text-right font-medium sm:table-cell">Disponível</th>
                  <th className="pb-3 text-right font-medium">%</th>
                </tr></thead>
                <tbody>{d.limitsByBank.map((b) => { const pct = b.limit > 0 ? Math.round((b.used / b.limit) * 100) : 0; return (
                  <tr key={b.institution} className="border-b border-slate-800/50">
                    <td className="py-3 font-medium text-white">{b.institution}</td>
                    <td className="py-3 text-right text-slate-300">{formatCurrency(b.limit)}</td>
                    <td className="py-3 text-right text-red-400">{formatCurrency(b.used)}</td>
                    <td className="hidden py-3 text-right text-emerald-400 sm:table-cell">{formatCurrency(b.available)}</td>
                    <td className="py-3 text-right"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${pct > 80 ? "bg-red-500/10 text-red-400" : pct > 50 ? "bg-yellow-500/10 text-yellow-400" : "bg-emerald-500/10 text-emerald-400"}`}>{pct}%</span></td>
                  </tr>); })}</tbody>
              </table>
            </div>
          ) : <p className="py-8 text-center text-sm text-slate-500">Nenhum cartão encontrado</p>}
        </CardContent>
      </Card>

      {/* ── Empréstimos ── */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-white"><Receipt className="h-5 w-5" />Empréstimos</CardTitle>
            {d?.totalLoanDebt ? <span className="text-xs text-red-400">Devedor: {formatCurrency(d.totalLoanDebt)}</span> : null}
          </div>
        </CardHeader>
        <CardContent>
          {d?.loans && d.loans.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                  <th className="pb-3 font-medium">Instituição</th>
                  <th className="hidden pb-3 font-medium sm:table-cell">Produto</th>
                  <th className="pb-3 text-right font-medium">Parcelas</th>
                  <th className="pb-3 text-right font-medium">Saldo</th>
                </tr></thead>
                <tbody>{d.loans.map((l) => (
                  <tr key={l.id} className="border-b border-slate-800/50">
                    <td className="py-3 font-medium text-white">{l.institution_name}</td>
                    <td className="hidden py-3 text-slate-300 sm:table-cell">{l.name}</td>
                    <td className="py-3 text-right"><span className="text-emerald-400">{l.paid_installments}</span><span className="text-slate-600"> / </span><span className="text-slate-300">{l.total_installments}</span></td>
                    <td className="py-3 text-right text-red-400">{formatCurrency(l.outstanding_balance)}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          ) : <p className="py-8 text-center text-sm text-slate-500">Nenhum empréstimo ativo</p>}
        </CardContent>
      </Card>

      {/* ── Score de crédito ── */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader><CardTitle className="flex items-center gap-2 text-white"><ShieldCheck className="h-5 w-5" />Score de Crédito</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
            <div className="flex flex-col items-center">
              <ScoreGauge score={d?.score?.score ?? null} />
              {d?.score && <p className="mt-2 text-xs text-slate-500">Registrado em {new Intl.DateTimeFormat("pt-BR").format(new Date(d.score.updated_at))}</p>}
            </div>
            <div className="flex-1 space-y-3">
              <p className="text-sm text-slate-400">Registrar score atual:</p>
              <div className="flex gap-2">
                <input type="number" min="0" max="1000" value={scoreInput} onChange={(e) => setScoreInput(e.target.value)} placeholder="Ex: 750" className="w-24 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none sm:w-32" />
                <Button onClick={handleSaveScore} disabled={savingScore} size="sm" className="gap-2 bg-emerald-500 text-slate-950 hover:bg-emerald-400">
                  <Save className="h-4 w-4" />{savingScore ? "..." : "Salvar"}
                </Button>
              </div>
              <ScoreLegend />
              {/* Score history mini chart */}
              {d?.scoreHistory && d.scoreHistory.length > 1 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs text-slate-500">Evolução no período</p>
                  <ResponsiveContainer width="100%" height={100}>
                    <LineChart data={d.scoreHistory}>
                      <XAxis dataKey="recorded_at" hide />
                      <YAxis domain={[0, 1000]} hide />
                      <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: "#10b981" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Consultas CPF ── */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Search className="h-5 w-5" />Consultas ao CPF</CardTitle></CardHeader>
        <CardContent>
          {d?.hasRecentCpfConsult && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-yellow-800 bg-yellow-950/20 p-3">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <p className="text-xs text-yellow-300">Consulta ao CPF nos últimos 30 dias — pode impactar seu score.</p>
            </div>
          )}
          {/* Formulário */}
          <div className="mb-4 flex flex-wrap gap-2">
            <input value={cpfInst} onChange={(e) => setCpfInst(e.target.value)} placeholder="Instituição" className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none" />
            <select value={cpfType} onChange={(e) => setCpfType(e.target.value)} className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none">
              <option>Consulta de crédito</option>
              <option>Empréstimo</option>
              <option>Cartão de crédito</option>
              <option>Financiamento</option>
              <option>Outro</option>
            </select>
            <Button onClick={handleSaveCpf} disabled={savingCpf} size="sm" className="gap-1 bg-emerald-500 text-slate-950 hover:bg-emerald-400">
              <Plus className="h-4 w-4" />Registrar
            </Button>
          </div>
          {/* Lista */}
          {d?.cpfConsultations && d.cpfConsultations.length > 0 ? (
            <div className="space-y-2">
              {d.cpfConsultations.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-800 px-4 py-2">
                  <div className="flex items-center gap-3">
                    <ArrowUpRight className="h-4 w-4 text-yellow-400" />
                    <div>
                      <p className="text-sm text-white">{c.institution}</p>
                      <p className="text-xs text-slate-500">{c.type}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">{formatDate(c.consulted_at)}</p>
                </div>
              ))}
            </div>
          ) : <p className="py-4 text-center text-sm text-slate-500">Nenhuma consulta registrada no período</p>}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Subcomponents ---

function MiniCard({ icon, label, value, color = "text-white" }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardContent className="p-5">
        <div className="flex items-center gap-3">{icon}<p className="text-xs text-slate-500">{label}</p></div>
        <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function ScoreGauge({ score }: { score: number | null }) {
  const s = score ?? 0;
  const pct = (s / 1000) * 100;
  const color = s >= 700 ? "#10b981" : s >= 500 ? "#eab308" : s >= 300 ? "#f97316" : "#ef4444";
  const label = s >= 700 ? "Excelente" : s >= 500 ? "Bom" : s >= 300 ? "Regular" : s > 0 ? "Baixo" : "—";
  const dash = `${(pct / 100) * (2 * Math.PI * 60 * 0.75)} ${2 * Math.PI * 60}`;
  return (
    <div className="flex flex-col items-center">
      <svg width="160" height="130" viewBox="0 0 160 140">
        <path d="M 20 120 A 60 60 0 1 1 140 120" fill="none" stroke="#1e293b" strokeWidth="12" strokeLinecap="round" />
        {score !== null && <path d="M 20 120 A 60 60 0 1 1 140 120" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={dash} className="transition-all duration-1000" />}
        <text x="80" y="90" textAnchor="middle" className="fill-white font-bold" fontSize="32">{score !== null ? s : "—"}</text>
        <text x="80" y="115" textAnchor="middle" className="fill-slate-400" fontSize="12">{label}</text>
      </svg>
      <p className="text-sm text-slate-500">de 1000 pontos</p>
    </div>
  );
}

function ScoreLegend() {
  return (
    <div className="flex flex-wrap gap-3">
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}</div>
      <div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}</div>
      <Skeleton className="h-72 rounded-lg" />
      <Skeleton className="h-64 rounded-lg" />
      <Skeleton className="h-48 rounded-lg" />
    </div>
  );
}

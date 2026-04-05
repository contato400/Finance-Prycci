"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UpgradeOverlay } from "@/components/upgrade-overlay";
import { usePlan } from "@/hooks/use-plan";
import { apiFetch } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  RadialBarChart, RadialBar,
} from "recharts";
import {
  Brain, Sparkles, AlertTriangle, Lightbulb, ArrowRight,
  RefreshCw, TrendingUp, TrendingDown,
  Send, MessageCircle, Bot, User,
} from "lucide-react";

interface Analysis {
  resumo: string;
  pontos_atencao: string[];
  recomendacoes: string[];
  proximos_passos: string[];
  score_saude: number;
}

interface CategoryData {
  category: string;
  total: number;
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
  categories: CategoryData[];
}

const CHART_COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1"];

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
      const a = json.analysis || {};
      json.analysis = {
        resumo: a.resumo || "",
        pontos_atencao: Array.isArray(a.pontos_atencao) ? a.pontos_atencao : [],
        recomendacoes: Array.isArray(a.recomendacoes) ? a.recomendacoes : [],
        proximos_passos: Array.isArray(a.proximos_passos) ? a.proximos_passos : [],
        score_saude: Number(a.score_saude) || 5,
      };
      json.categories = Array.isArray(json.categories) ? json.categories : [];
      setData(json);
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  const snap = data?.dataSnapshot;
  const saldoLiquido = snap ? snap.receitaMensal - snap.gastoTotal : 0;
  const gastosPercent = snap && snap.receitaMensal > 0 ? Math.round((snap.gastoTotal / snap.receitaMensal) * 100) : 0;

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
          <div className="grid gap-4 sm:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
          <Skeleton className="h-64 rounded-lg" />
          <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-48 rounded-lg" /><Skeleton className="h-48 rounded-lg" /></div>
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
              Clique em &quot;Gerar Análise&quot; para receber uma avaliação completa da sua saúde financeira.
            </p>
          </CardContent>
        </Card>
      )}

      {data && !loading && (
        <>
          {/* 1. BARRA DE RESUMO */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-slate-800 bg-slate-900 px-5 py-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-slate-500">Receita</span>
              <span className="text-sm font-bold text-emerald-400">{formatCurrency(snap?.receitaMensal ?? 0)}</span>
            </div>
            <div className="h-4 w-px bg-slate-700" />
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-400" />
              <span className="text-xs text-slate-500">Gastos</span>
              <span className="text-sm font-bold text-red-400">{formatCurrency(snap?.gastoTotal ?? 0)}</span>
              <span className="text-[10px] text-slate-600">({gastosPercent}%)</span>
            </div>
            <div className="h-4 w-px bg-slate-700" />
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${saldoLiquido >= 0 ? "bg-emerald-400" : "bg-red-400"}`} />
              <span className="text-xs text-slate-500">Líquido</span>
              <span className={`text-sm font-bold ${saldoLiquido >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatCurrency(saldoLiquido)}</span>
            </div>
            <div className="h-4 w-px bg-slate-700" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Crédito</span>
              <span className="text-sm font-bold text-white">{formatCurrency(snap?.creditoUsado ?? 0)}</span>
              <span className="text-[10px] text-slate-600">de {formatCurrency(snap?.creditoLimite ?? 0)}</span>
            </div>
          </div>

          {/* 2. GRÁFICOS: Distribuição + Score lado a lado */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Gráfico de barras — gastos por categoria */}
            {data.categories.length > 0 && (
              <Card className="border-slate-800 bg-slate-900 lg:col-span-2">
                <CardHeader><CardTitle className="text-sm text-white">Distribuição de Gastos</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.categories} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="category" width={120} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", color: "#f8fafc" }}
                        formatter={(v) => [formatCurrency(Number(v)), "Total"]}
                      />
                      <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                        {data.categories.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-2 space-y-1">
                    {data.categories.map((c, i) => {
                      const pct = snap && snap.gastoTotal > 0 ? Math.round((c.total / snap.gastoTotal) * 100) : 0;
                      return (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                            <span className="text-slate-400">{c.category}</span>
                          </div>
                          <span className="text-slate-300">{formatCurrency(c.total)} <span className="text-slate-600">({pct}%)</span></span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 3. Gauge de Score */}
            <Card className="border-slate-800 bg-slate-900">
              <CardHeader><CardTitle className="text-sm text-white">Saúde Financeira</CardTitle></CardHeader>
              <CardContent className="flex flex-col items-center">
                <ScoreGauge score={data.analysis.score_saude} />
                <p className="mt-2 text-center text-xs text-slate-500">Baseado nos seus dados dos últimos 30 dias</p>
              </CardContent>
            </Card>
          </div>

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

          {/* 4. Pontos de Atenção + Recomendações */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-l-4 border-l-yellow-500 border-slate-800 bg-slate-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                  Pontos de Atenção
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.analysis.pontos_atencao.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg border border-yellow-500/10 bg-yellow-500/5 p-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow-500/20 text-xs font-bold text-yellow-400">{i + 1}</span>
                      <p className="text-sm leading-relaxed text-slate-300">{item}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500 border-slate-800 bg-slate-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Lightbulb className="h-5 w-5 text-blue-400" />
                  Recomendações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.analysis.recomendacoes.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg border border-blue-500/10 bg-blue-500/5 p-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-400">{i + 1}</span>
                      <p className="text-sm leading-relaxed text-slate-300">{item}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Próximos Passos */}
          <Card className="border-l-4 border-l-emerald-500 border-slate-800 bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <ArrowRight className="h-5 w-5 text-emerald-400" />
                Próximos Passos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {data.analysis.proximos_passos.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg border border-emerald-500/10 bg-emerald-500/5 p-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-bold text-emerald-400">{i + 1}</span>
                    <p className="text-sm leading-relaxed text-slate-300">{item}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 5. Chat com IA Financeira */}
          <ChatIA dataSnapshot={data.dataSnapshot} />

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

// --- Sub-components ---

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function ChatIA({ dataSnapshot }: { dataSnapshot: InsightsData["dataSnapshot"] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Olá! Analisei suas finanças. Você tem receita de ${formatCurrency(dataSnapshot.receitaMensal)}, gastos de ${formatCurrency(dataSnapshot.gastoTotal)} e saldo de ${formatCurrency(dataSnapshot.saldo)}. Como posso te ajudar hoje?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const history = messages.map((m) => ({ role: m.role === "user" ? "user" : "model", content: m.content }));
      const res = await apiFetch("/api/insights/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const json = await res.json();
      const reply = json.reply || json.error || "Erro ao processar.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Erro de conexão. Tente novamente." }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <MessageCircle className="h-5 w-5 text-emerald-400" />
          Converse com sua IA Financeira
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={scrollRef} className="h-[400px] space-y-3 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                  <Bot className="h-4 w-4 text-emerald-400" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-emerald-500/20 text-emerald-100"
                  : "bg-slate-800 text-slate-300"
              }`}>
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </div>
              {msg.role === "user" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700">
                  <User className="h-4 w-4 text-slate-300" />
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                <Bot className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="rounded-lg bg-slate-800 px-3 py-2">
                <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />
              </div>
            </div>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Pergunte sobre suas finanças..."
            disabled={sending}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
          />
          <Button onClick={handleSend} disabled={sending || !input.trim()} size="sm" className="gap-1 bg-emerald-500 px-4 text-slate-950 hover:bg-emerald-400">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 8 ? "#10b981" : score >= 5 ? "#eab308" : "#ef4444";
  const label = score >= 8 ? "Excelente" : score >= 5 ? "Boa" : "Atenção";
  const gaugeData = [{ name: "score", value: score * 10, fill: color }];

  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width={180} height={180}>
        <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" startAngle={180} endAngle={0} data={gaugeData} barSize={14}>
          <RadialBar dataKey="value" cornerRadius={10} background={{ fill: "#1e293b" }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="-mt-16 text-center">
        <span className="text-3xl font-bold text-white">{score}</span>
        <span className="text-sm text-slate-400">/10</span>
        <p className="text-xs" style={{ color }}>{label}</p>
      </div>
    </div>
  );
}

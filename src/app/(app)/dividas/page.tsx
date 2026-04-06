"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { Receipt, AlertTriangle, Clock, CheckCircle, Sparkles, RefreshCw } from "lucide-react";

interface Loan {
  id: string; institution_name: string; name: string; total_amount: number;
  installment_amount: number; total_installments: number; paid_installments: number;
  outstanding_balance: number; interest_rate: number;
}

interface Bill {
  id: number; institution_name: string; description: string; amount: number;
  due_date: string; status: string;
}

export default function DividasPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [totalDevedor, setTotalDevedor] = useState(0);
  const [totalAberto, setTotalAberto] = useState(0);
  const [vencidos, setVencidos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [analise, setAnalise] = useState("");
  const [loadingIA, setLoadingIA] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/dividas/loans").then((r) => r.json()),
      apiFetch("/api/dividas/bills").then((r) => r.json()),
    ]).then(([loansData, billsData]) => {
      setLoans(loansData.loans || []);
      setTotalDevedor(loansData.totalDevedor || 0);
      setBills(billsData.bills || []);
      setTotalAberto(billsData.totalAberto || 0);
      setVencidos(billsData.vencidos || 0);
    }).finally(() => setLoading(false));
  }, []);

  // Auto-gerar análise
  useEffect(() => {
    if (!loading && (loans.length > 0 || bills.length > 0)) gerarAnalise();
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  async function gerarAnalise() {
    setLoadingIA(true);
    try {
      const res = await apiFetch("/api/credit/ai-analysis", { method: "POST" });
      const json = await res.json();
      setAnalise(json.analise || "");
    } catch { /* */ }
    finally { setLoadingIA(false); }
  }

  const today = new Date().toISOString().split("T")[0];

  if (loading) return (
    <div className="space-y-6">
      <div><Skeleton className="h-8 w-48" /><Skeleton className="mt-2 h-4 w-64" /></div>
      <div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
      <Skeleton className="h-48 rounded-lg" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dívidas & Compromissos</h1>
        <p className="text-sm text-slate-400">Empréstimos, financiamentos e boletos</p>
      </div>

      {/* Resumo */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Total em Aberto</p>
            <p className="mt-1 text-xl font-bold text-red-400">{formatCurrency(totalDevedor + totalAberto)}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Empréstimos Ativos</p>
            <p className="mt-1 text-xl font-bold text-white">{loans.length}</p>
            {totalDevedor > 0 && <p className="text-[10px] text-slate-600">Saldo devedor: {formatCurrency(totalDevedor)}</p>}
          </CardContent>
        </Card>
        <Card className={`border-slate-800 ${vencidos > 0 ? "bg-red-950/20" : "bg-slate-900"}`}>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Boletos Vencidos</p>
            <p className={`mt-1 text-xl font-bold ${vencidos > 0 ? "text-red-400" : "text-emerald-400"}`}>
              {vencidos > 0 ? vencidos : "Nenhum"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Empréstimos */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Receipt className="h-5 w-5" />Empréstimos & Financiamentos</CardTitle></CardHeader>
        <CardContent>
          {loans.length > 0 ? (
            <div className="space-y-4">
              {loans.map((loan) => {
                const pctPago = loan.total_installments > 0 ? Math.round((loan.paid_installments / loan.total_installments) * 100) : 0;
                return (
                  <div key={loan.id} className="rounded-lg border border-slate-800 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">{loan.name}</p>
                        <p className="text-xs text-slate-500">{loan.institution_name}</p>
                      </div>
                      <span className="text-sm font-bold text-red-400">{formatCurrency(loan.outstanding_balance)}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                      <span>Parcelas: <span className="text-emerald-400">{loan.paid_installments}</span>/{loan.total_installments}</span>
                      <span>Taxa: {loan.interest_rate}%</span>
                      <span>Contrato: {formatCurrency(loan.total_amount)}</span>
                    </div>
                    <Progress value={pctPago} className="mt-2 h-1.5 [&>div]:bg-emerald-500" />
                    <p className="mt-1 text-right text-[10px] text-slate-600">{pctPago}% quitado</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">Nenhum empréstimo encontrado.</p>
          )}
        </CardContent>
      </Card>

      {/* Boletos */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Clock className="h-5 w-5" />Boletos</CardTitle></CardHeader>
        <CardContent>
          {bills.length > 0 ? (
            <div className="space-y-2">
              {bills.map((bill) => {
                const isVencido = bill.due_date && bill.due_date < today;
                const isHoje = bill.due_date === today;
                const isPago = bill.status === "PAID";
                return (
                  <div key={bill.id} className={`flex items-center justify-between rounded-lg border px-4 py-3 ${isVencido && !isPago ? "border-red-800 bg-red-950/20" : "border-slate-800"}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white">{bill.description}</p>
                      <p className="text-xs text-slate-500">{bill.institution_name} — {bill.due_date}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-white">{formatCurrency(bill.amount)}</span>
                      {isPago ? (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400"><CheckCircle className="h-3 w-3" />PAGO</span>
                      ) : isVencido ? (
                        <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] text-red-400"><AlertTriangle className="h-3 w-3" />VENCIDO</span>
                      ) : isHoje ? (
                        <span className="flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] text-yellow-400"><Clock className="h-3 w-3" />HOJE</span>
                      ) : (
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">A VENCER</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">Nenhum boleto encontrado. Sincronize seus bancos.</p>
          )}
        </CardContent>
      </Card>

      {/* Análise IA */}
      {(loans.length > 0 || bills.length > 0) && (
        <Card className="border-l-4 border-l-emerald-500 border-slate-800 bg-slate-900">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-white"><Sparkles className="h-5 w-5 text-emerald-400" />Análise da IA</CardTitle>
              <Button onClick={gerarAnalise} disabled={loadingIA} size="sm" variant="outline" className="gap-1 border-slate-700 text-xs text-slate-300">
                {loadingIA ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingIA ? <Skeleton className="h-20 rounded" /> : analise ? (
              <div className="space-y-3 text-sm leading-relaxed text-slate-300">
                {analise.split(/\n\n|\n/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

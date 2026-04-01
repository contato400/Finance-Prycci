"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Check, Zap, Building2 } from "lucide-react";
import { PLANS, type PlanType } from "@/lib/plans";
import { apiFetch } from "@/lib/api-client";
import { useState } from "react";

const PLAN_ICONS: Record<PlanType, React.ReactNode> = {
  free: <BarChart3 className="h-6 w-6" />,
  pro: <Zap className="h-6 w-6" />,
  business: <Building2 className="h-6 w-6" />,
};

const PLAN_COLORS: Record<PlanType, { bg: string; text: string; btn: string; border: string }> = {
  free: {
    bg: "bg-slate-900",
    text: "text-slate-300",
    btn: "bg-slate-700 text-white hover:bg-slate-600",
    border: "border-slate-800",
  },
  pro: {
    bg: "bg-emerald-950/30",
    text: "text-emerald-400",
    btn: "bg-emerald-500 text-slate-950 hover:bg-emerald-400",
    border: "border-emerald-500/50",
  },
  business: {
    bg: "bg-blue-950/30",
    text: "text-blue-400",
    btn: "bg-blue-500 text-white hover:bg-blue-400",
    border: "border-blue-500/50",
  },
};

export default function PricingPage() {
  const [loading, setLoading] = useState<PlanType | null>(null);

  async function handleCheckout(plan: PlanType) {
    if (plan === "free") return;
    setLoading(plan);
    try {
      const res = await apiFetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.message || "Checkout ainda não configurado. Configure STRIPE_SECRET_KEY.");
      }
    } catch {
      alert("Erro ao iniciar checkout.");
    } finally {
      setLoading(null);
    }
  }

  const planOrder: PlanType[] = ["free", "pro", "business"];

  return (
    <div className="flex min-h-screen flex-col items-center bg-slate-950 px-4 py-16">
      {/* Header */}
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500">
        <BarChart3 className="h-7 w-7 text-slate-950" />
      </div>
      <h1 className="text-3xl font-bold text-white">FinanceOS</h1>
      <p className="mt-2 text-slate-400">Escolha o plano ideal para suas finanças</p>

      {/* Plans grid */}
      <div className="mt-12 grid w-full max-w-4xl gap-6 sm:grid-cols-3">
        {planOrder.map((planId) => {
          const plan = PLANS[planId];
          const colors = PLAN_COLORS[planId];
          const isPopular = planId === "pro";

          return (
            <Card
              key={planId}
              className={`relative ${colors.bg} ${colors.border} border transition-transform hover:scale-[1.02]`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-semibold text-slate-950">
                  Mais popular
                </div>
              )}
              <CardHeader className="text-center">
                <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl ${
                  planId === "free" ? "bg-slate-800" : planId === "pro" ? "bg-emerald-500/10" : "bg-blue-500/10"
                } ${colors.text}`}>
                  {PLAN_ICONS[planId]}
                </div>
                <CardTitle className="mt-3 text-white">{plan.name}</CardTitle>
                <div className="mt-2">
                  {plan.price === 0 ? (
                    <span className="text-3xl font-bold text-white">Grátis</span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold text-white">
                        R$ {plan.price.toFixed(2).replace(".", ",")}
                      </span>
                      <span className="text-sm text-slate-400">/mês</span>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-300">
                      <Check className={`mt-0.5 h-4 w-4 shrink-0 ${colors.text}`} />
                      {feature}
                    </li>
                  ))}
                </ul>
                {planId === "free" ? (
                  <Link href="/cadastro" className="block">
                    <Button className={`w-full ${colors.btn}`}>
                      Começar grátis
                    </Button>
                  </Link>
                ) : (
                  <Button
                    className={`w-full ${colors.btn}`}
                    onClick={() => handleCheckout(planId)}
                    disabled={loading === planId}
                  >
                    {loading === planId ? "Carregando..." : "Assinar"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-12 text-center text-sm text-slate-500">
        <p>Cancele a qualquer momento. Sem compromisso.</p>
        <Link href="/login" className="mt-2 inline-block text-emerald-400 hover:underline">
          Já tem conta? Entrar
        </Link>
      </div>
    </div>
  );
}

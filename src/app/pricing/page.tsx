"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Check, Zap, Building2 } from "lucide-react";

const PLANS = [
  {
    id: "free",
    name: "Gratuito",
    price: "R$ 0",
    sub: "",
    icon: <BarChart3 className="h-6 w-6" />,
    popular: false,
    features: [
      "1 banco conectado",
      "Histórico de 30 dias",
      "Dashboard básico",
      "Categorização automática",
    ],
    cta: "Criar conta grátis",
    href: "/cadastro",
    colors: {
      bg: "bg-slate-900",
      border: "border-slate-800",
      text: "text-slate-300",
      icon: "bg-slate-800 text-slate-300",
      btn: "bg-slate-700 text-white hover:bg-slate-600",
    },
  },
  {
    id: "pro",
    name: "Pro",
    price: "R$ 97,00",
    sub: "/mês",
    icon: <Zap className="h-6 w-6" />,
    popular: true,
    features: [
      "Bancos ilimitados",
      "Histórico completo",
      "Score de crédito",
      "Simulador de financiamento",
      "Insights com IA",
      "Suporte prioritário",
    ],
    cta: "Assinar Pro",
    href: "/cadastro?plan=pro",
    colors: {
      bg: "bg-emerald-950/30",
      border: "border-emerald-500/50",
      text: "text-emerald-400",
      icon: "bg-emerald-500/10 text-emerald-400",
      btn: "bg-emerald-500 text-slate-950 hover:bg-emerald-400",
    },
  },
  {
    id: "business",
    name: "Business",
    price: "R$ 197,00",
    sub: "/mês",
    icon: <Building2 className="h-6 w-6" />,
    popular: false,
    features: [
      "Tudo do Pro",
      "Até 5 membros",
      "Relatórios em PDF",
      "API própria",
      "Suporte dedicado",
    ],
    cta: "Falar com equipe",
    href: "mailto:contato@financeos.com.br",
    colors: {
      bg: "bg-blue-950/30",
      border: "border-blue-500/50",
      text: "text-blue-400",
      icon: "bg-blue-500/10 text-blue-400",
      btn: "bg-blue-500 text-white hover:bg-blue-400",
    },
  },
];

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-slate-950 px-4 py-16">
      {/* Header */}
      <Link href="/" className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500">
        <BarChart3 className="h-7 w-7 text-slate-950" />
      </Link>
      <h1 className="text-3xl font-bold text-white">FinanceOS</h1>
      <p className="mt-2 text-center text-slate-400">
        Escolha o plano ideal para organizar suas finanças
      </p>

      {/* Nav */}
      <div className="mt-6 flex gap-4 text-sm">
        <Link href="/login" className="text-slate-400 hover:text-white">Entrar</Link>
        <Link href="/cadastro" className="text-slate-400 hover:text-white">Criar conta</Link>
      </div>

      {/* Plans grid */}
      <div className="mt-12 grid w-full max-w-4xl gap-6 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <Card
            key={plan.id}
            className={`relative ${plan.colors.bg} ${plan.colors.border} border transition-transform hover:scale-[1.02]`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-semibold text-slate-950">
                Mais popular
              </div>
            )}
            <CardHeader className="text-center">
              <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl ${plan.colors.icon}`}>
                {plan.icon}
              </div>
              <CardTitle className="mt-3 text-white">{plan.name}</CardTitle>
              <div className="mt-2">
                <span className="text-3xl font-bold text-white">{plan.price}</span>
                {plan.sub && <span className="text-sm text-slate-400">{plan.sub}</span>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-slate-300">
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan.colors.text}`} />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link href={plan.href} className="block">
                <Button className={`w-full ${plan.colors.btn}`}>
                  {plan.cta}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-12 space-y-2 text-center text-sm text-slate-500">
        <p>Cancele a qualquer momento. Sem compromisso.</p>
        <Link href="/login" className="inline-block text-emerald-400 hover:underline">
          Já tem conta? Entrar
        </Link>
      </div>
    </div>
  );
}

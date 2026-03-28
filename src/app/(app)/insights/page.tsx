"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Brain, Sparkles } from "lucide-react";

export default function InsightsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Insights</h1>
        <p className="text-sm text-slate-400">Análise inteligente com IA</p>
      </div>

      <Card className="border-slate-800 bg-slate-900">
        <CardContent className="flex flex-col items-center py-16">
          <div className="relative mb-6">
            <Brain className="h-16 w-16 text-slate-600" />
            <Sparkles className="absolute -right-2 -top-2 h-6 w-6 text-emerald-500" />
          </div>
          <h2 className="text-lg font-semibold text-white">Em breve</h2>
          <p className="mt-2 max-w-md text-center text-sm text-slate-400">
            A análise com IA será ativada em breve. Conecte seus bancos e
            sincronize os dados para que os insights sejam gerados com base no
            seu perfil financeiro completo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

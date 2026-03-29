"use client";

import { formatCurrency, calcPercentage } from "@/lib/utils";
import { Wifi } from "lucide-react";

interface CreditCardVisualProps {
  card: {
    id: string;
    name: string;
    last4: string;
    balance: number;
    credit_limit: number;
    available_limit: number;
    accounts?: {
      pluggy_items?: { institution_name: string } | null;
    } | null;
  };
  selected?: boolean;
  onClick?: () => void;
}

// Cores de fundo por instituição
const CARD_GRADIENTS: Record<string, string> = {
  nubank: "from-purple-700 via-purple-800 to-purple-950",
  nu: "from-purple-700 via-purple-800 to-purple-950",
  inter: "from-orange-600 via-orange-700 to-orange-900",
  itaú: "from-blue-700 via-blue-800 to-blue-950",
  itau: "from-blue-700 via-blue-800 to-blue-950",
  bradesco: "from-red-700 via-red-800 to-red-950",
  santander: "from-red-600 via-red-700 to-red-900",
  c6: "from-gray-700 via-gray-800 to-gray-950",
  btg: "from-blue-900 via-slate-800 to-slate-950",
  xp: "from-slate-700 via-slate-800 to-slate-950",
};

function getCardGradient(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, gradient] of Object.entries(CARD_GRADIENTS)) {
    if (lower.includes(key)) return gradient;
  }
  return "from-slate-700 via-slate-800 to-slate-950";
}

// Componente visual de cartão de crédito (estilo cartão físico, dark)
export function CreditCardVisual({ card, selected, onClick }: CreditCardVisualProps) {
  const institutionName = card.accounts?.pluggy_items?.institution_name || card.name;
  const gradient = getCardGradient(institutionName);
  const usagePercent = calcPercentage(card.balance, card.credit_limit);

  return (
    <div
      onClick={onClick}
      className={`group cursor-pointer transition-all duration-200 ${
        selected ? "scale-[1.02]" : "hover:scale-[1.01]"
      }`}
    >
      {/* Cartão visual */}
      <div
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-6 shadow-xl ${
          selected ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-slate-950" : ""
        }`}
      >
        {/* Padrão decorativo */}
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-white/5" />

        {/* Header do cartão */}
        <div className="relative flex items-center justify-between">
          <p className="text-sm font-semibold text-white/90">{institutionName}</p>
          <Wifi className="h-5 w-5 rotate-90 text-white/60" />
        </div>

        {/* Chip */}
        <div className="relative mt-6 flex items-center gap-3">
          <div className="h-9 w-12 rounded-md bg-gradient-to-br from-yellow-300 to-yellow-500 opacity-80" />
        </div>

        {/* Número do cartão */}
        <div className="relative mt-5">
          <p className="font-mono text-lg tracking-[0.25em] text-white/80">
            •••• •••• •••• {card.last4}
          </p>
        </div>

        {/* Nome e bandeira */}
        <div className="relative mt-4 flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/40">
              Nome no cartão
            </p>
            <p className="text-sm font-medium text-white/80">{card.name}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-white/40">
              Crédito
            </p>
            <p className="text-xs text-white/60">CREDIT</p>
          </div>
        </div>
      </div>

      {/* Info abaixo do cartão */}
      <div className="mt-3 space-y-2 px-1">
        {/* Barra de uso */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full transition-all ${
              usagePercent > 80
                ? "bg-red-500"
                : usagePercent > 50
                  ? "bg-yellow-500"
                  : "bg-emerald-500"
            }`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">
            Usado:{" "}
            <span className="font-medium text-white">
              {formatCurrency(card.balance)}
            </span>
          </span>
          <span className={`font-medium ${
            usagePercent > 80 ? "text-red-400" : usagePercent > 50 ? "text-yellow-400" : "text-emerald-400"
          }`}>
            {usagePercent}%
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Limite: {formatCurrency(card.credit_limit)}</span>
          <span>Disponível: {formatCurrency(card.available_limit)}</span>
        </div>
      </div>
    </div>
  );
}

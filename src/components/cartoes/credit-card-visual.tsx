"use client";

import { formatCurrency, calcPercentage } from "@/lib/utils";
import { Wifi } from "lucide-react";
import { BankAvatar } from "@/components/bank-avatar";
import { getGradientFromName } from "@/lib/bank-logos";

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

// Componente visual de cartão de crédito (estilo cartão físico, dark)
export function CreditCardVisual({ card, selected, onClick }: CreditCardVisualProps) {
  const institutionName = card.accounts?.pluggy_items?.institution_name || card.name;
  const gradient = getGradientFromName(institutionName);
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
        className={`relative overflow-hidden rounded-2xl p-6 shadow-xl ${
          selected ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-slate-950" : ""
        }`}
        style={{ background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})` }}
      >
        {/* Padrão decorativo */}
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-white/5" />

        {/* Header do cartão */}
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BankAvatar bankName={institutionName} size={32} />
            <p className="text-sm font-semibold text-white/90">{institutionName}</p>
          </div>
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

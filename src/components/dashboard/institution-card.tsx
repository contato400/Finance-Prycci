"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, calcPercentage } from "@/lib/utils";
import { Building2 } from "lucide-react";

interface InstitutionCardProps {
  institution: {
    name: string;
    balance: number;
    creditLimit: number;
    creditUsed: number;
  };
}

// Mapeamento de cores por instituição conhecida
const INSTITUTION_COLORS: Record<string, string> = {
  "Nu Pagamentos": "bg-purple-600",
  "Nubank": "bg-purple-600",
  "Inter": "bg-orange-500",
  "Banco Inter": "bg-orange-500",
  "Itaú": "bg-blue-600",
  "Bradesco": "bg-red-600",
  "Banco do Brasil": "bg-yellow-500",
  "Santander": "bg-red-500",
  "C6 Bank": "bg-gray-700",
  "BTG Pactual": "bg-blue-800",
  "XP": "bg-slate-700",
};

function getInstitutionColor(name: string): string {
  for (const [key, color] of Object.entries(INSTITUTION_COLORS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return "bg-slate-600";
}

// Card de instituição financeira no dashboard
export function InstitutionCard({ institution }: InstitutionCardProps) {
  const creditPercent = calcPercentage(institution.creditUsed, institution.creditLimit);
  const color = getInstitutionColor(institution.name);

  return (
    <Card className="border-slate-800 bg-slate-900 transition-colors hover:border-slate-700">
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{institution.name}</p>
            <p className="text-xs text-slate-500">Instituição financeira</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Saldo</span>
            <span className="text-sm font-semibold text-emerald-400">
              {formatCurrency(institution.balance)}
            </span>
          </div>

          {institution.creditLimit > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Limite do Cartão</span>
                <span className="text-sm text-slate-300">
                  {formatCurrency(institution.creditLimit)}
                </span>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-slate-500">{creditPercent}% utilizado</span>
                  <span className="text-xs text-slate-500">
                    {formatCurrency(institution.creditUsed)}
                  </span>
                </div>
                <Progress
                  value={creditPercent}
                  className={`h-1.5 ${
                    creditPercent > 80
                      ? "[&>div]:bg-red-500"
                      : creditPercent > 50
                        ? "[&>div]:bg-yellow-500"
                        : "[&>div]:bg-emerald-500"
                  }`}
                />
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

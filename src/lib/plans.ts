// Definições de planos e limites

export type PlanType = "free" | "pro" | "business";

export interface PlanLimits {
  maxBanks: number;
  historyDays: number;
  hasAI: boolean;
  hasCreditScore: boolean;
  hasSimulator: boolean;
  hasExport: boolean;
  hasAPI: boolean;
  maxMembers: number;
}

export interface PlanInfo {
  id: PlanType;
  name: string;
  price: number; // R$/mês, 0 = grátis
  limits: PlanLimits;
  features: string[];
}

export const PLANS: Record<PlanType, PlanInfo> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    limits: {
      maxBanks: 1,
      historyDays: 30,
      hasAI: false,
      hasCreditScore: false,
      hasSimulator: false,
      hasExport: false,
      hasAPI: false,
      maxMembers: 1,
    },
    features: [
      "1 banco conectado",
      "Histórico de 30 dias",
      "Dashboard completo",
      "Categorização automática",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 29.90,
    limits: {
      maxBanks: Infinity,
      historyDays: Infinity,
      hasAI: true,
      hasCreditScore: true,
      hasSimulator: true,
      hasExport: false,
      hasAPI: false,
      maxMembers: 1,
    },
    features: [
      "Bancos ilimitados",
      "Histórico completo",
      "Score de crédito + simulador",
      "Insights com IA",
      "Suporte prioritário",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    price: 79.90,
    limits: {
      maxBanks: Infinity,
      historyDays: Infinity,
      hasAI: true,
      hasCreditScore: true,
      hasSimulator: true,
      hasExport: true,
      hasAPI: true,
      maxMembers: 5,
    },
    features: [
      "Tudo do Pro",
      "Até 5 membros",
      "Relatórios em PDF",
      "API própria",
      "Suporte dedicado",
    ],
  },
};

export function getPlanLimits(plan: PlanType): PlanLimits {
  return PLANS[plan]?.limits ?? PLANS.free.limits;
}

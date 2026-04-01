"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/session-provider";
import { apiFetch } from "@/lib/api-client";
import { type PlanType, type PlanLimits, getPlanLimits, PLANS } from "@/lib/plans";

interface UsePlanReturn {
  plan: PlanType;
  limits: PlanLimits;
  loading: boolean;
  isPro: boolean;
  isBusiness: boolean;
  canUse: (feature: keyof PlanLimits) => boolean;
}

export function usePlan(): UsePlanReturn {
  const { user } = useAuth();
  const [plan, setPlan] = useState<PlanType>("free");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    apiFetch("/api/user/plan")
      .then((res) => res.json())
      .then((data) => {
        if (data.plan && data.plan in PLANS) {
          setPlan(data.plan as PlanType);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const limits = getPlanLimits(plan);

  return {
    plan,
    limits,
    loading,
    isPro: plan === "pro" || plan === "business",
    isBusiness: plan === "business",
    canUse: (feature) => {
      const val = limits[feature];
      if (typeof val === "boolean") return val;
      if (typeof val === "number") return val > 0;
      return true;
    },
  };
}

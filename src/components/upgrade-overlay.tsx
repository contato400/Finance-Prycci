"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UpgradeOverlayProps {
  feature: string;
  plan?: "Pro" | "Business";
  children: React.ReactNode;
  locked: boolean;
}

export function UpgradeOverlay({ feature, plan = "Pro", children, locked }: UpgradeOverlayProps) {
  if (!locked) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-30 blur-[2px]">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-slate-950/60 backdrop-blur-sm">
        <Lock className="h-8 w-8 text-slate-400" />
        <p className="text-center text-sm text-slate-300">
          {feature}
        </p>
        <p className="text-xs text-slate-500">Disponível no plano {plan}</p>
        <Link href="/pricing">
          <Button size="sm" className="bg-emerald-500 text-slate-950 hover:bg-emerald-400">
            Fazer upgrade
          </Button>
        </Link>
      </div>
    </div>
  );
}

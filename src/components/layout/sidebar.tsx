"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Landmark,
  CreditCard,
  TrendingUp,
  BarChart3,
  Brain,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";

// Itens do menu lateral
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contas", label: "Contas", icon: Landmark },
  { href: "/cartoes", label: "Cartões", icon: CreditCard },
  { href: "/credito", label: "Crédito", icon: BarChart3 },
  { href: "/investimentos", label: "Investimentos", icon: TrendingUp },
  { href: "/insights", label: "Insights", icon: Brain },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Botão mobile */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-screen w-64 border-r border-slate-800 bg-slate-950 transition-transform lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-slate-800 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500">
            <BarChart3 className="h-5 w-5 text-slate-950" />
          </div>
          <span className="text-lg font-bold text-white">FinanceOS</span>
        </div>

        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "text-slate-400 hover:bg-slate-900 hover:text-white"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

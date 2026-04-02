"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { DateRangeProvider } from "@/contexts/date-range-context";
import { useAuth } from "@/components/providers/session-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect } from "react";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = "/login";
    }
  }, [loading, user]);

  // Enquanto carrega sessão, mostra skeleton
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  // Se não tem usuário, não renderiza nada (useEffect vai redirecionar)
  if (!user) return null;

  return (
    <DateRangeProvider>
      <div className="min-h-screen bg-slate-950">
        <Sidebar />
        <div className="lg:pl-64">
          <Header />
          <main className="p-4 md:p-6">{children}</main>
        </div>
      </div>
    </DateRangeProvider>
  );
}

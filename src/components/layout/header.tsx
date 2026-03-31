"use client";

import { RefreshCw, LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/date-range-picker";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

export function Header() {
  const { data: session } = useSession();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    try {
      // 1. Sincronizar dados da Pluggy
      toast({ title: "Sincronizando dados bancários..." });
      const res = await fetch("/api/pluggy/sync", { method: "POST" });
      const data = await res.json();

      if (!res.ok || data.error) {
        toast({ title: "Erro na sincronização", description: data.error || `Status ${res.status}`, variant: "destructive" });
        if (data.logs) console.info("[sync logs]", data.logs);
        return;
      }

      // 2. Forçar recálculo do cache (redundância se o inline no sync falhou)
      toast({ title: "Atualizando dashboard..." });
      await fetch("/api/pluggy/force-cache", { method: "POST" }).catch(() => {});

      // 2. Sucesso — mostrar toast com hora atual
      const now = new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      setLastSync(now);

      const msg = data.message || "Dados atualizados.";
      const itemErrors = data.itemErrors as Array<{ itemId: string; error: string }> | undefined;
      toast({
        title: itemErrors?.length ? "Sincronização parcial" : `Dados atualizados • ${now}`,
        description: itemErrors?.length ? `${msg} (${itemErrors.length} erro(s))` : msg,
      });

      // 3. Recarregar para refletir os dados novos
      window.location.reload();
    } catch (err) {
      toast({ title: "Erro de rede", description: err instanceof Error ? err.message : "Sem conexão.", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 backdrop-blur-sm sm:px-6 lg:pl-72">
      <div className="flex min-w-0 items-center gap-3 pl-12 lg:pl-0">
        <h2 className="truncate text-base font-semibold text-white sm:text-lg">
          Olá, {session?.user?.name ?? "Usuário"}
        </h2>
        {lastSync && (
          <span className="hidden text-xs text-slate-500 sm:inline">Sync: {lastSync}</span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <DateRangePicker />
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          className="gap-2 border-slate-700 text-slate-300 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">{syncing ? "Sincronizando..." : "Sincronizar"}</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={() => signOut({ callbackUrl: "/login" })} className="text-slate-400 hover:text-white">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}

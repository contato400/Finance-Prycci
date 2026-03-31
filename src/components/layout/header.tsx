"use client";

import { RefreshCw, LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/date-range-picker";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

// Parse seguro de resposta — trata texto puro e JSON inválido
async function safeJson(res: Response): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    return { ok: res.ok, data };
  } catch {
    console.error("Resposta não-JSON:", text.slice(0, 200));
    return { ok: false, data: { error: text.slice(0, 100) } };
  }
}

export function Header() {
  const { data: session } = useSession();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    try {
      // 1. Sincronizar
      toast({ title: "Sincronizando dados bancários..." });
      const syncResult = await safeJson(await fetch("/api/pluggy/sync", { method: "POST" }));

      if (!syncResult.ok || syncResult.data.error) {
        toast({
          title: "Erro na sincronização",
          description: String(syncResult.data.error || "Erro desconhecido"),
          variant: "destructive",
        });
        if (syncResult.data.logs) console.info("[sync logs]", syncResult.data.logs);
        return;
      }

      // 2. Forçar cache (redundância)
      toast({ title: "Atualizando dashboard..." });
      await fetch("/api/pluggy/force-cache", { method: "POST" }).catch(() => {});

      // 3. Sucesso
      const now = new Date().toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
      setLastSync(now);

      const msg = String(syncResult.data.message || "Dados atualizados.");
      const itemErrors = syncResult.data.itemErrors as Array<{ itemId: string; error: string }> | undefined;
      toast({
        title: itemErrors?.length ? "Sincronização parcial" : `Dados atualizados • ${now}`,
        description: itemErrors?.length ? `${msg} (${itemErrors.length} erro(s))` : msg,
      });

      window.location.reload();
    } catch (err) {
      toast({
        title: "Erro de rede",
        description: err instanceof Error ? err.message : "Sem conexão com o servidor.",
        variant: "destructive",
      });
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

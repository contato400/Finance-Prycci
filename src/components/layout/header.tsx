"use client";

import { RefreshCw, LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

export function Header() {
  const { data: session } = useSession();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/pluggy/sync", { method: "POST" });
      if (!res.ok) throw new Error("Erro ao sincronizar");
      setLastSync(new Date().toLocaleString("pt-BR"));
      toast({
        title: "Sincronização concluída",
        description: "Todos os dados foram atualizados.",
      });
    } catch {
      toast({
        title: "Erro na sincronização",
        description: "Verifique sua conexão e tente novamente.",
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
          <span className="hidden text-xs text-slate-500 sm:inline">
            Última sync: {lastSync}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          className="gap-2 border-slate-700 text-slate-300 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Sincronizar</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-slate-400 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}

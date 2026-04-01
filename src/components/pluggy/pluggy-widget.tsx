"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Lock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { usePlan } from "@/hooks/use-plan";

export function PluggyWidget() {
  const [loading, setLoading] = useState(false);
  const { limits } = usePlan();

  async function handleConnect() {
    setLoading(true);

    try {
      // Verificar limite de bancos do plano
      const countRes = await apiFetch("/api/user/bank-count");
      const { count } = await countRes.json();
      if (count >= limits.maxBanks) {
        toast({
          title: "Limite de bancos atingido",
          description: `Seu plano permite ${limits.maxBanks} banco(s). Faça upgrade para conectar mais.`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // 1. Gerar connect token
      const tokenRes = await apiFetch("/api/pluggy/connect-token", { method: "POST" });
      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({}));
        throw new Error(err.error || `Erro ao gerar token (${tokenRes.status})`);
      }
      const { accessToken } = await tokenRes.json();

      // 2. Carregar e abrir o Pluggy Connect Widget
      const { PluggyConnect } = await import("pluggy-connect-sdk");

      const pluggyConnect = new PluggyConnect({
        connectToken: accessToken,
        theme: "dark",
        onSuccess: async (data) => {
          const itemId = data.item.id;
          toast({ title: "Banco conectado!", description: "Salvando dados..." });

          try {
            const saveRes = await apiFetch("/api/pluggy/items", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ itemId }),
            });
            if (!saveRes.ok) {
              const err = await saveRes.json().catch(() => ({}));
              throw new Error(err.error || `Erro ao salvar item (${saveRes.status})`);
            }

            toast({ title: "Sincronizando dados...", description: "Buscando contas, transações e investimentos." });
            const syncRes = await apiFetch("/api/pluggy/sync", { method: "POST" });
            const syncData = await syncRes.json();
            await apiFetch("/api/pluggy/force-cache", { method: "POST" });

            if (syncRes.ok && syncData.synced) {
              toast({ title: "Banco adicionado com sucesso!", description: syncData.message });
            } else {
              toast({ title: "Banco salvo, mas sincronização falhou", description: syncData.error || syncData.message || "Tente sincronizar novamente.", variant: "destructive" });
            }
            window.location.reload();
          } catch (saveErr) {
            toast({ title: "Erro ao salvar conexão", description: saveErr instanceof Error ? saveErr.message : "Erro desconhecido", variant: "destructive" });
          }
        },
        onError: (error) => {
          toast({ title: "Erro na conexão", description: error.message, variant: "destructive" });
          setLoading(false);
        },
        onClose: () => { setLoading(false); },
      });

      await pluggyConnect.init();
    } catch (err) {
      toast({ title: "Erro ao abrir widget", description: err instanceof Error ? err.message : "Erro desconhecido", variant: "destructive" });
      setLoading(false);
    }
  }

  // Se limite é finito e já atingiu, mostrar botão de upgrade
  if (limits.maxBanks < Infinity) {
    return (
      <div className="flex items-center gap-2">
        <Button
          onClick={handleConnect}
          disabled={loading}
          className="gap-2 bg-emerald-500 text-slate-950 hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" />
          {loading ? "Conectando..." : "Adicionar Banco"}
        </Button>
        <Link href="/pricing">
          <Button variant="ghost" size="sm" className="gap-1 text-xs text-slate-400 hover:text-white">
            <Lock className="h-3 w-3" />
            Limite: {limits.maxBanks}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <Button
      onClick={handleConnect}
      disabled={loading}
      className="gap-2 bg-emerald-500 text-slate-950 hover:bg-emerald-400"
    >
      <Plus className="h-4 w-4" />
      {loading ? "Conectando..." : "Adicionar Banco"}
    </Button>
  );
}

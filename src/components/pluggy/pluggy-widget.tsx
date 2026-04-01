"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";

// Componente que abre o Pluggy Connect Widget para adicionar novas contas.
// Fluxo: gera connectToken → abre widget → onSuccess recebe itemId →
// salva no banco via POST /api/pluggy/items → sincroniza via POST /api/pluggy/sync.
export function PluggyWidget() {
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    setLoading(true);

    try {
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
          toast({
            title: "Banco conectado!",
            description: "Salvando dados...",
          });

          try {
            // 3. Salvar o itemId no banco (pluggy_items)
            const saveRes = await apiFetch("/api/pluggy/items", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ itemId }),
            });

            if (!saveRes.ok) {
              const err = await saveRes.json().catch(() => ({}));
              throw new Error(err.error || `Erro ao salvar item (${saveRes.status})`);
            }

            // 4. Sincronizar dados do item
            toast({
              title: "Sincronizando dados...",
              description: "Buscando contas, transações e investimentos.",
            });

            const syncRes = await apiFetch("/api/pluggy/sync", { method: "POST" });
            const syncData = await syncRes.json();

            // 5. Atualizar cache do dashboard
            await apiFetch("/api/pluggy/force-cache", { method: "POST" });

            if (syncRes.ok && syncData.synced) {
              toast({
                title: "Banco adicionado com sucesso!",
                description: syncData.message,
              });
            } else {
              toast({
                title: "Banco salvo, mas sincronização falhou",
                description: syncData.error || syncData.message || "Tente sincronizar novamente.",
                variant: "destructive",
              });
            }

            window.location.reload();
          } catch (saveErr) {
            const msg = saveErr instanceof Error ? saveErr.message : "Erro desconhecido";
            toast({
              title: "Erro ao salvar conexão",
              description: msg,
              variant: "destructive",
            });
          }
        },
        onError: (error) => {
          toast({
            title: "Erro na conexão",
            description: error.message,
            variant: "destructive",
          });
          setLoading(false);
        },
        onClose: () => {
          setLoading(false);
        },
      });

      await pluggyConnect.init();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast({
        title: "Erro ao abrir widget",
        description: msg,
        variant: "destructive",
      });
      setLoading(false);
    }
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

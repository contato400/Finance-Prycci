"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// Componente que abre o Pluggy Connect Widget para adicionar novas contas bancárias
export function PluggyWidget() {
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    setLoading(true);

    try {
      // 1. Gerar connect token
      const tokenRes = await fetch("/api/pluggy/connect-token", { method: "POST" });
      if (!tokenRes.ok) throw new Error("Erro ao gerar token");
      const { accessToken } = await tokenRes.json();

      // 2. Carregar e abrir o Pluggy Connect Widget
      const { PluggyConnect } = await import("pluggy-connect-sdk");

      const pluggyConnect = new PluggyConnect({
        connectToken: accessToken,
        theme: "dark",
        onSuccess: async (data) => {
          try {
            // 3. Salvar o item conectado no banco
            await fetch("/api/pluggy/items", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ itemId: data.item.id }),
            });

            // 4. Sincronizar dados
            await fetch("/api/pluggy/sync", { method: "POST" });

            toast({ title: "Banco conectado com sucesso!" });
            window.location.reload();
          } catch {
            toast({ title: "Erro ao salvar conexão", variant: "destructive" });
          }
        },
        onError: (error) => {
          toast({
            title: "Erro na conexão",
            description: error.message,
            variant: "destructive",
          });
        },
        onClose: () => {
          setLoading(false);
        },
      });

      await pluggyConnect.init();
    } catch {
      toast({ title: "Erro ao abrir widget", variant: "destructive" });
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

"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/session-provider";
import { usePlan } from "@/hooks/use-plan";
import { PLANS } from "@/lib/plans";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "@/hooks/use-toast";
import { User, Mail, LogOut, Shield, ArrowUpRight, Save } from "lucide-react";

export default function PerfilPage() {
  const { user, signOut } = useAuth();
  const { plan, loading: planLoading } = usePlan();

  const currentName = user?.user_metadata?.name || "";
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const displayName = currentName || user?.email?.split("@")[0] || "Usuário";
  const email = user?.email || "—";
  const createdAt = user?.created_at
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(user.created_at))
    : "—";

  const planInfo = PLANS[plan];

  async function handleSaveName() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.auth.updateUser({
        data: { name: name.trim() },
      });
      if (error) throw error;
      toast({ title: "Nome atualizado!" });
      // Reload para atualizar o header
      window.location.reload();
    } catch (err) {
      toast({ title: "Erro ao salvar", description: err instanceof Error ? err.message : "Erro", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Perfil</h1>
        <p className="text-sm text-slate-400">Suas informações de conta</p>
      </div>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white">Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 shrink-0 text-slate-400" />
            <div className="flex-1">
              <p className="text-xs text-slate-500">Nome</p>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={displayName}
                  className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                />
                <Button
                  size="sm"
                  onClick={handleSaveName}
                  disabled={saving || !name.trim() || name.trim() === currentName}
                  className="gap-1 bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "..." : "Salvar"}
                </Button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">Email</p>
              <p className="text-sm font-medium text-white">{email}</p>
            </div>
          </div>
          <p className="text-xs text-slate-600">Membro desde {createdAt}</p>
        </CardContent>
      </Card>

      {/* Plano */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Shield className="h-5 w-5 text-slate-400" />
            Plano
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {planLoading ? (
            <p className="text-sm text-slate-500">Carregando...</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  plan === "business" ? "bg-blue-500/10 text-blue-400" :
                  plan === "pro" ? "bg-emerald-500/10 text-emerald-400" :
                  "bg-slate-800 text-slate-300"
                }`}>
                  {planInfo.name}
                </span>
                {planInfo.price > 0 && (
                  <span className="text-sm text-slate-500">
                    R$ {planInfo.price.toFixed(2).replace(".", ",")}/mês
                  </span>
                )}
              </div>
              <ul className="space-y-1">
                {planInfo.features.map((f) => (
                  <li key={f} className="text-xs text-slate-400">• {f}</li>
                ))}
              </ul>
              {plan === "free" && (
                <Link href="/pricing">
                  <Button size="sm" className="mt-2 gap-1 bg-emerald-500 text-slate-950 hover:bg-emerald-400">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    Fazer upgrade
                  </Button>
                </Link>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Button
        variant="outline"
        onClick={signOut}
        className="gap-2 border-red-800 text-red-400 hover:bg-red-950/30 hover:text-red-300"
      >
        <LogOut className="h-4 w-4" />
        Sair da conta
      </Button>
    </div>
  );
}

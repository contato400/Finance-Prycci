"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/session-provider";
import { User, Mail, LogOut, Shield } from "lucide-react";

export default function PerfilPage() {
  const { user, signOut } = useAuth();

  const name = user?.user_metadata?.name || "Usuário";
  const email = user?.email || "—";
  const createdAt = user?.created_at
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(user.created_at))
    : "—";

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
            <User className="h-5 w-5 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">Nome</p>
              <p className="text-sm font-medium text-white">{name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">Email</p>
              <p className="text-sm font-medium text-white">{email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">Plano</p>
              <p className="text-sm font-medium text-emerald-400">Free</p>
            </div>
          </div>
          <p className="text-xs text-slate-600">Membro desde {createdAt}</p>
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

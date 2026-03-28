"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Senha incorreta");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <Card className="w-full max-w-sm border-slate-800 bg-slate-900">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500">
            <BarChart3 className="h-7 w-7 text-slate-950" />
          </div>
          <CardTitle className="text-xl text-white">FinanceOS</CardTitle>
          <p className="text-sm text-slate-400">Digite sua senha para acessar</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              autoFocus
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button
              type="submit"
              className="w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              disabled={loading}
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    console.log("SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log("KEY_PREFIX:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 15));

    const supabase = createSupabaseBrowser();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      console.error("Supabase login error:", authError);
      setError(authError.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
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
          <p className="text-sm text-slate-400">Entre na sua conta</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              autoFocus
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              required
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
          <div className="mt-4 space-y-2 text-center text-sm">
            <p className="text-slate-500">
              Não tem conta?{" "}
              <Link href="/cadastro" className="text-emerald-400 hover:underline">
                Criar conta
              </Link>
            </p>
            <Link href="/recuperar-senha" className="text-slate-500 hover:text-slate-300">
              Esqueci minha senha
            </Link>
            <div>
              <Link href="/pricing" className="text-slate-500 hover:text-slate-300">
                Ver planos
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

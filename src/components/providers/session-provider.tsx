"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import { updateCachedToken } from "@/lib/api-client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowser();

    // Get initial session
    supabase.auth.getSession().then((result: { data: { session: Session | null } }) => {
      const s = result.data.session;
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      // Alimentar cache do apiFetch
      updateCachedToken(s?.access_token ?? null, s?.expires_at);
    });

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, newSession: Session | null) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
      // Atualizar cache do apiFetch imediatamente
      updateCachedToken(newSession?.access_token ?? null, newSession?.expires_at);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    const supabase = createSupabaseBrowser();
    updateCachedToken(null);
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}

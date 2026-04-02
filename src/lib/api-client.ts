import { createSupabaseBrowser } from "@/lib/supabase/browser";

// Cache do token para evitar chamadas repetidas ao getSession
let _cachedToken: string | null = null;
let _tokenExpiry = 0;

// Chamado pelo AuthSessionProvider quando a sessão muda
export function updateCachedToken(token: string | null, expiresAt?: number) {
  _cachedToken = token;
  _tokenExpiry = expiresAt ? expiresAt * 1000 : 0;
}

// Aguarda o token ficar disponível (max 3s)
async function waitForToken(): Promise<string | null> {
  // Se já tem token cacheado e válido, retorna imediatamente
  if (_cachedToken && _tokenExpiry > Date.now()) {
    return _cachedToken;
  }

  // Tentar getSession
  const supabase = createSupabaseBrowser();
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    updateCachedToken(session.access_token, session.expires_at);
    return session.access_token;
  }

  // Esperar o AuthSessionProvider alimentar o cache (até 3s)
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (_cachedToken) return _cachedToken;

    // Tentar getSession de novo a cada iteração
    const { data: { session: retrySession } } = await supabase.auth.getSession();
    if (retrySession?.access_token) {
      updateCachedToken(retrySession.access_token, retrySession.expires_at);
      return retrySession.access_token;
    }
  }

  // Último recurso: refreshSession
  const { data: refreshData } = await supabase.auth.refreshSession();
  if (refreshData?.session?.access_token) {
    updateCachedToken(refreshData.session.access_token, refreshData.session.expires_at);
    return refreshData.session.access_token;
  }

  return null;
}

// Wrapper de fetch que automaticamente inclui o token de autenticação
export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const token = await waitForToken();

  if (!token) {
    console.warn("[apiFetch] Sem token para", url, "— redirecionando para login");
    // Se não tem token após todas as tentativas, redirecionar para login
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    return new Response(JSON.stringify({ error: "Sem sessão ativa" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const headers = new Headers(options?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(url, { ...options, headers });

  // Se recebeu 401, limpar cache e tentar refresh uma vez
  if (res.status === 401) {
    _cachedToken = null;
    _tokenExpiry = 0;
    const supabase = createSupabaseBrowser();
    const { data: retryData } = await supabase.auth.refreshSession();
    if (retryData?.session?.access_token) {
      updateCachedToken(retryData.session.access_token, retryData.session.expires_at);
      const retryHeaders = new Headers(options?.headers);
      retryHeaders.set("Authorization", `Bearer ${retryData.session.access_token}`);
      return fetch(url, { ...options, headers: retryHeaders });
    }
  }

  return res;
}

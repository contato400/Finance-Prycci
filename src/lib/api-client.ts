import { createSupabaseBrowser } from "@/lib/supabase/browser";

// Cache do token
let _cachedToken: string | null = null;
let _tokenExpiry = 0;

// Chamado pelo AuthSessionProvider quando a sessão muda
export function updateCachedToken(token: string | null, expiresAt?: number) {
  _cachedToken = token;
  _tokenExpiry = expiresAt ? expiresAt * 1000 : 0;
}

// Busca token: cache → getSession → refreshSession
async function getToken(): Promise<string | null> {
  if (_cachedToken && _tokenExpiry > Date.now()) {
    return _cachedToken;
  }

  const supabase = createSupabaseBrowser();

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    updateCachedToken(session.access_token, session.expires_at);
    return session.access_token;
  }

  const { data: refreshData } = await supabase.auth.refreshSession();
  if (refreshData?.session?.access_token) {
    updateCachedToken(refreshData.session.access_token, refreshData.session.expires_at);
    return refreshData.session.access_token;
  }

  return null;
}

// Wrapper de fetch com token automático
export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const token = await getToken();

  const headers = new Headers(options?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });

  // Se 401 e tinha token, tentar refresh uma vez
  if (res.status === 401 && token) {
    _cachedToken = null;
    _tokenExpiry = 0;
    const freshToken = await getToken();
    if (freshToken && freshToken !== token) {
      const retryHeaders = new Headers(options?.headers);
      retryHeaders.set("Authorization", `Bearer ${freshToken}`);
      return fetch(url, { ...options, headers: retryHeaders });
    }
  }

  return res;
}

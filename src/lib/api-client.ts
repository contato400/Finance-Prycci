import { createSupabaseBrowser } from "@/lib/supabase/browser";

// Cache do token para evitar chamadas repetidas ao getSession
let _cachedToken: string | null = null;
let _tokenExpiry = 0;

// Wrapper de fetch que automaticamente inclui o token de autenticação
export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const now = Date.now();

  // Usar token cacheado se ainda válido (com margem de 60s)
  if (_cachedToken && _tokenExpiry > now + 60000) {
    const headers = new Headers(options?.headers);
    headers.set("Authorization", `Bearer ${_cachedToken}`);
    return fetch(url, { ...options, headers });
  }

  // Buscar sessão fresca
  const supabase = createSupabaseBrowser();
  let token: string | null = null;

  // Tentar getSession primeiro
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    token = session.access_token;
    _tokenExpiry = (session.expires_at ?? 0) * 1000;
  }

  // Se não conseguiu, tentar refreshSession
  if (!token) {
    const { data: refreshData } = await supabase.auth.refreshSession();
    if (refreshData?.session?.access_token) {
      token = refreshData.session.access_token;
      _tokenExpiry = (refreshData.session.expires_at ?? 0) * 1000;
    }
  }

  // Se ainda não conseguiu, tentar ler do cookie diretamente
  if (!token) {
    // @supabase/ssr armazena o token em cookies com prefixo sb-
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name?.includes("auth-token") && value) {
        try {
          const parsed = JSON.parse(decodeURIComponent(value));
          if (parsed?.access_token) {
            token = parsed.access_token;
            break;
          }
        } catch {
          // Cookie pode estar em formato diferente
          if (value.startsWith("ey")) {
            token = decodeURIComponent(value);
            break;
          }
        }
      }
    }
  }

  if (token) {
    _cachedToken = token;
  } else {
    console.warn("[apiFetch] Sem token para", url);
  }

  const headers = new Headers(options?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });

  // Se recebeu 401, limpar cache e tentar refresh uma vez
  if (res.status === 401 && token) {
    _cachedToken = null;
    _tokenExpiry = 0;
    const { data: retryData } = await supabase.auth.refreshSession();
    if (retryData?.session?.access_token) {
      _cachedToken = retryData.session.access_token;
      _tokenExpiry = (retryData.session.expires_at ?? 0) * 1000;
      const retryHeaders = new Headers(options?.headers);
      retryHeaders.set("Authorization", `Bearer ${retryData.session.access_token}`);
      return fetch(url, { ...options, headers: retryHeaders });
    }
  }

  return res;
}

// Chamado pelo AuthSessionProvider quando a sessão muda
export function updateCachedToken(token: string | null, expiresAt?: number) {
  _cachedToken = token;
  _tokenExpiry = expiresAt ? expiresAt * 1000 : 0;
}

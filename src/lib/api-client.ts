import { createSupabaseBrowser } from "@/lib/supabase/browser";

// Wrapper de fetch que automaticamente inclui o token de autenticação
export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const supabase = createSupabaseBrowser();
  const { data: { session } } = await supabase.auth.getSession();

  const headers = new Headers(options?.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  } else {
    // Se não tem sessão, tentar refresh
    const { data: refreshData } = await supabase.auth.refreshSession();
    if (refreshData?.session?.access_token) {
      headers.set("Authorization", `Bearer ${refreshData.session.access_token}`);
    } else {
      console.warn("[apiFetch] Sem sessão ativa para", url);
    }
  }

  return fetch(url, { ...options, headers });
}

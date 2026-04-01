import { createSupabaseBrowser } from "@/lib/supabase/browser";

// Wrapper de fetch que automaticamente inclui o token de autenticação
export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const supabase = createSupabaseBrowser();
  const { data: { session } } = await supabase.auth.getSession();

  const headers = new Headers(options?.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  return fetch(url, { ...options, headers });
}

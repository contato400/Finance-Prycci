// Helper para chamadas diretas à Supabase REST API via fetch nativo.
// Substitui o @supabase/supabase-js que falha em ambientes server-side (Vercel/Node).

const getBaseUrl = () => (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim() + "/rest/v1";
const getKey = () => (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

function headers(extra?: Record<string, string>): Record<string, string> {
  const key = getKey();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

// Tipos de resposta
export interface SupabaseError {
  message: string;
  code?: string;
  hint?: string;
}

interface QueryResult<T> {
  data: T | null;
  error: SupabaseError | null;
}

// SELECT — busca registros de uma tabela
// query: string no formato PostgREST, ex: "id=eq.123&type=eq.BANK"
// options: select (colunas), order, limit, offset
export async function supabaseSelect<T = Record<string, unknown>>(
  table: string,
  options?: {
    select?: string;
    filter?: string;
    order?: string;
    limit?: number;
    single?: boolean;
    count?: boolean;
  }
): Promise<QueryResult<T[]> & { count?: number }> {
  try {
    const params = new URLSearchParams();
    if (options?.select) params.set("select", options.select);
    if (options?.order) params.set("order", options.order);
    if (options?.limit) params.set("limit", String(options.limit));

    let url = `${getBaseUrl()}/${table}?${params}`;
    if (options?.filter) url += `&${options.filter}`;

    const extraHeaders: Record<string, string> = {};
    if (options?.count) extraHeaders["Prefer"] = "count=exact";

    const res = await fetch(url, {
      method: "GET",
      headers: headers(extraHeaders),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
      return { data: null, error: body as SupabaseError };
    }

    const data = await res.json();

    // Extrair count do header se solicitado
    let count: number | undefined;
    if (options?.count) {
      const range = res.headers.get("content-range");
      if (range) {
        const total = range.split("/")[1];
        count = total === "*" ? undefined : parseInt(total);
      }
    }

    if (options?.single) {
      const item = Array.isArray(data) ? data[0] ?? null : data;
      return { data: item ? [item] : null, error: null, count } as QueryResult<T[]> & { count?: number };
    }

    return { data: data as T[], error: null, count };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
  }
}

// INSERT — insere registros
export async function supabaseInsert<T = Record<string, unknown>>(
  table: string,
  data: Record<string, unknown> | Record<string, unknown>[]
): Promise<QueryResult<T[]>> {
  try {
    const res = await fetch(`${getBaseUrl()}/${table}`, {
      method: "POST",
      headers: headers({ Prefer: "return=representation" }),
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
      return { data: null, error: body as SupabaseError };
    }

    const result = await res.json();
    return { data: result as T[], error: null };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
  }
}

// UPSERT — insere ou atualiza (merge) baseado em coluna de conflito
export async function supabaseUpsert<T = Record<string, unknown>>(
  table: string,
  data: Record<string, unknown> | Record<string, unknown>[],
  onConflict: string
): Promise<QueryResult<T[]>> {
  try {
    const res = await fetch(
      `${getBaseUrl()}/${table}?on_conflict=${onConflict}`,
      {
        method: "POST",
        headers: headers({
          Prefer: "return=representation,resolution=merge-duplicates",
        }),
        body: JSON.stringify(Array.isArray(data) ? data : [data]),
      }
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
      return { data: null, error: body as SupabaseError };
    }

    const result = await res.json();
    return { data: result as T[], error: null };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
  }
}

// UPDATE — atualiza registros com filtro
export async function supabaseUpdate<T = Record<string, unknown>>(
  table: string,
  data: Record<string, unknown>,
  filter: string
): Promise<QueryResult<T[]>> {
  try {
    const res = await fetch(
      `${getBaseUrl()}/${table}?${filter}`,
      {
        method: "PATCH",
        headers: headers({ Prefer: "return=representation" }),
        body: JSON.stringify(data),
      }
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
      return { data: null, error: body as SupabaseError };
    }

    const result = await res.json();
    return { data: result as T[], error: null };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
  }
}

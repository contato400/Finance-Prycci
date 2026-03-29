import { PluggyClient } from "pluggy-sdk";

const PLUGGY_BASE_URL = "https://api.pluggy.ai";

// Cria instância do Pluggy Client com as credenciais do ambiente
export function createPluggyClient(): PluggyClient {
  return new PluggyClient({
    clientId: process.env.PLUGGY_CLIENT_ID!,
    clientSecret: process.env.PLUGGY_CLIENT_SECRET!,
  });
}

// Gera apiKey via POST /auth para chamadas REST diretas
export async function getPluggyApiKey(): Promise<string> {
  const res = await fetch(`${PLUGGY_BASE_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: process.env.PLUGGY_CLIENT_ID!,
      clientSecret: process.env.PLUGGY_CLIENT_SECRET!,
      nonExpiring: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Pluggy auth falhou (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.apiKey;
}

// Tenta listar items via GET /items (pode retornar 401 no plano dev)
export interface PluggyItemResponse {
  id: string;
  connector: { id: number; name: string };
  status: string;
  executionStatus: string;
  createdAt: string;
  updatedAt: string;
}

interface FetchItemsResult {
  items: PluggyItemResponse[];
  method: "api" | "none";
  error?: string;
}

export async function fetchAllItemsFromApi(apiKey: string): Promise<FetchItemsResult> {
  try {
    const res = await fetch(`${PLUGGY_BASE_URL}/items?page=1&pageSize=50`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      return {
        items: [],
        method: "none",
        error: `GET /items retornou ${res.status}: ${body.substring(0, 200)}`,
      };
    }

    const data = await res.json();
    const items: PluggyItemResponse[] = data.results || [];

    // Buscar páginas adicionais se existirem
    if (items.length > 0 && items.length < (data.total || 0)) {
      let page = 2;
      while (items.length < (data.total || 0)) {
        const nextRes = await fetch(`${PLUGGY_BASE_URL}/items?page=${page}&pageSize=50`, {
          headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
        });
        if (!nextRes.ok) break;
        const nextData = await nextRes.json();
        const nextItems: PluggyItemResponse[] = nextData.results || [];
        if (nextItems.length === 0) break;
        items.push(...nextItems);
        page++;
      }
    }

    return { items, method: "api" };
  } catch (err) {
    return {
      items: [],
      method: "none",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

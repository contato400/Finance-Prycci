import { PluggyClient } from "pluggy-sdk";

const PLUGGY_BASE_URL = "https://api.pluggy.ai";

// Cria instância do Pluggy Client com as credenciais do ambiente
export function createPluggyClient(): PluggyClient {
  return new PluggyClient({
    clientId: process.env.PLUGGY_CLIENT_ID!,
    clientSecret: process.env.PLUGGY_CLIENT_SECRET!,
  });
}

// Gera apiKey via POST /auth (o SDK faz internamente, mas precisamos
// para chamadas diretas à API REST que o SDK não cobre)
async function getApiKey(): Promise<string> {
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
    throw new Error(`Pluggy auth failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.apiKey;
}

// Lista todos os items do usuário via API REST (o SDK não tem esse método)
export interface PluggyItemResponse {
  id: string;
  connector: {
    id: number;
    name: string;
  };
  status: string;
  executionStatus: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchAllItems(): Promise<PluggyItemResponse[]> {
  const apiKey = await getApiKey();
  const allItems: PluggyItemResponse[] = [];
  let page = 1;

  // Paginar até não ter mais resultados
  while (true) {
    const res = await fetch(`${PLUGGY_BASE_URL}/items?page=${page}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Pluggy fetchItems failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    const items: PluggyItemResponse[] = data.results || [];

    allItems.push(...items);

    // Se retornou menos que o page size, acabou
    if (items.length === 0 || allItems.length >= (data.total || 0)) {
      break;
    }
    page++;
  }

  return allItems;
}

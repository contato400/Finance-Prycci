import { PluggyClient } from "pluggy-sdk";

// Cria instância do Pluggy Client com as credenciais do ambiente.
// O SDK faz autenticação (POST /auth) automaticamente ao primeiro uso.
export function createPluggyClient(): PluggyClient {
  return new PluggyClient({
    clientId: (process.env.PLUGGY_CLIENT_ID || "").trim(),
    clientSecret: (process.env.PLUGGY_CLIENT_SECRET || "").trim(),
  });
}

import { PluggyClient } from "pluggy-sdk";

// Cria instância do Pluggy Client com as credenciais do ambiente
export function createPluggyClient(): PluggyClient {
  return new PluggyClient({
    clientId: process.env.PLUGGY_CLIENT_ID!,
    clientSecret: process.env.PLUGGY_CLIENT_SECRET!,
  });
}

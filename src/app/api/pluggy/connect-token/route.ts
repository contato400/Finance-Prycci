import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPluggyClient } from "@/lib/pluggy/client";

// Gera um connectToken para o Pluggy Connect Widget
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const itemId = (body as { itemId?: string }).itemId;

    const client = createPluggyClient();
    const { accessToken } = await client.createConnectToken(itemId || undefined);

    return NextResponse.json({ accessToken });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerar token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

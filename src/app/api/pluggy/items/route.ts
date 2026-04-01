import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { createPluggyClient } from "@/lib/pluggy/client";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

// Salva um novo item do Pluggy no banco
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const { itemId } = (await request.json()) as { itemId: string };
    if (!itemId) {
      return NextResponse.json({ error: "itemId é obrigatório" }, { status: 400 });
    }

    const pluggy = createPluggyClient();
    const item = await pluggy.fetchItem(itemId);

    const [row] = await sql`
      INSERT INTO pluggy_items (item_id, institution_name, status, user_id)
      VALUES (${itemId}, ${item.connector.name}, ${item.status}, ${userId})
      ON CONFLICT (item_id) DO UPDATE SET
        institution_name = EXCLUDED.institution_name,
        status = EXCLUDED.status
      RETURNING *
    `;

    return NextResponse.json({ item: row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Lista todos os items conectados do usuário
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;

    const items = await sql`
      SELECT * FROM pluggy_items WHERE user_id = ${userId} ORDER BY created_at DESC
    `;

    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar items";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

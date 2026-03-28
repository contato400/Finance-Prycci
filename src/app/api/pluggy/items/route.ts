import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPluggyClient } from "@/lib/pluggy/client";
import { createSupabaseServer } from "@/lib/supabase/server";

// Salva um novo item do Pluggy no banco de dados
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { itemId } = (await request.json()) as { itemId: string };
    if (!itemId) {
      return NextResponse.json({ error: "itemId é obrigatório" }, { status: 400 });
    }

    const pluggy = createPluggyClient();
    const item = await pluggy.fetchItem(itemId);

    const supabase = createSupabaseServer();

    // Upsert para evitar duplicatas
    const { data, error } = await supabase
      .from("pluggy_items")
      .upsert(
        {
          item_id: itemId,
          institution_name: item.connector.name,
          status: item.status,
        },
        { onConflict: "item_id" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Lista todos os items conectados
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const supabase = createSupabaseServer();
    const { data, error } = await supabase
      .from("pluggy_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao buscar items";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import sql from "@/lib/db";

// Registra consulta ao CPF
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { institution, type, consulted_at } = (await request.json()) as {
      institution: string; type?: string; consulted_at?: string;
    };

    if (!institution) {
      return NextResponse.json({ error: "Instituição é obrigatória" }, { status: 400 });
    }

    const [row] = await sql`
      INSERT INTO cpf_consultations (institution, type, consulted_at)
      VALUES (${institution}, ${type || "Consulta de crédito"}, ${consulted_at || new Date().toISOString().split("T")[0]})
      RETURNING *
    `;

    return NextResponse.json({ consultation: row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

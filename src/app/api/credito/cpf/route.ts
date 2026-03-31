import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";

// Registra consulta ao CPF
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

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

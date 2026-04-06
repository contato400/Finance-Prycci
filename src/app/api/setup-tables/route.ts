import { NextResponse } from "next/server";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

// Rota temporária para criar tabelas de IA no banco
// Acesse: /api/setup-tables para executar
export async function GET() {
  const results: string[] = [];

  try {
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS ai_memory (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    results.push("ai_memory: criada");

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS ai_chat_history (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    results.push("ai_chat_history: criada");

    await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_ai_memory_user ON ai_memory(user_id)`);
    results.push("idx_ai_memory_user: criado");

    await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_ai_chat_history_user ON ai_chat_history(user_id, created_at DESC)`);
    results.push("idx_ai_chat_history_user: criado");

    // Verificar
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_name IN ('ai_memory', 'ai_chat_history')
      ORDER BY table_name`;

    return NextResponse.json({
      success: true,
      results,
      tables: tables.map((t) => t.table_name),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      results,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

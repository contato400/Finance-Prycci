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

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS bills (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        item_id UUID,
        pluggy_bill_id TEXT UNIQUE,
        institution_name TEXT,
        description TEXT,
        amount FLOAT,
        due_date DATE,
        status TEXT DEFAULT 'PENDING',
        bar_code TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    results.push("bills: criada");

    await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_bills_user ON bills(user_id)`);
    results.push("idx_bills_user: criado");

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS financial_snapshots (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        month TEXT NOT NULL,
        receita FLOAT DEFAULT 0,
        gastos FLOAT DEFAULT 0,
        saldo FLOAT DEFAULT 0,
        credito_usado FLOAT DEFAULT 0,
        credito_limite FLOAT DEFAULT 0,
        investido FLOAT DEFAULT 0,
        score_saude INT DEFAULT 0,
        gastos_por_categoria JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, month)
      )
    `);
    results.push("financial_snapshots: criada");

    // Verificar
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_name IN ('ai_memory', 'ai_chat_history', 'bills', 'financial_snapshots')
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

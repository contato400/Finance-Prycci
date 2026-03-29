import postgres from "postgres";

// Conexão direta ao PostgreSQL do Supabase via Transaction Pooler.
// Usa o pacote 'postgres' (porsager/postgres) com connection string.
// Em serverless (Vercel), cada invocação cria uma conexão via pool.

const connectionString = (process.env.DATABASE_URL || "").trim();

if (!connectionString) {
  console.warn("[db] DATABASE_URL não configurada. Queries vão falhar.");
}

const sql = postgres(connectionString, {
  // Serverless: sem idle connections persistentes
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
  // SSL obrigatório para Supabase
  ssl: "require",
  // Não preparar statements (incompatível com transaction pooler)
  prepare: false,
});

export default sql;

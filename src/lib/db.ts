import postgres from "postgres";

const connectionString = (process.env.DATABASE_URL || "").trim();

if (!connectionString) {
  console.warn("[db] DATABASE_URL não configurada.");
}

// Adicionar statement_timeout na connection string para limitar queries a 8s
const urlWithTimeout = connectionString
  ? connectionString + (connectionString.includes("?") ? "&" : "?") + "options=-c%20statement_timeout%3D8000"
  : "";

const sql = postgres(urlWithTimeout, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 8,
  ssl: "require",
  prepare: false,
});

export default sql;

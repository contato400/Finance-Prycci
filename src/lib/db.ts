import postgres from "postgres";

const connectionString = (process.env.DATABASE_URL || "").trim();

if (!connectionString) {
  console.warn("[db] DATABASE_URL não configurada. Queries vão falhar.");
}

const urlWithTimeout = connectionString
  ? connectionString + (connectionString.includes("?") ? "&" : "?") + "options=-c%20statement_timeout%3D8000"
  : "postgresql://localhost:5432/placeholder";

const sql = postgres(urlWithTimeout, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 8,
  ssl: connectionString ? "require" : false,
  prepare: false,
});

export default sql;

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.DATABASE_URL;

  // Test DB connectivity
  let dbStatus = "not tested";
  try {
    const sql = (await import("@/lib/db")).default;
    const [row] = await sql`SELECT COUNT(*)::int AS total FROM pluggy_items`;
    dbStatus = `OK — ${row.total} pluggy_items`;
  } catch (e) {
    dbStatus = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Test user_id values in DB
  let userIds: string[] = [];
  try {
    const sql = (await import("@/lib/db")).default;
    const rows = await sql`SELECT DISTINCT user_id FROM pluggy_items LIMIT 5`;
    userIds = rows.map((r) => r.user_id);
  } catch {
    userIds = ["query failed"];
  }

  return Response.json({
    supabase_url_set: !!url,
    supabase_url: url ?? null,
    anon_key_set: !!key,
    anon_key_prefix: key ? key.substring(0, 20) + "..." : null,
    anon_key_format: key?.startsWith("eyJ") ? "JWT (correto)" :
                     key?.startsWith("sb_") ? "novo formato" : "desconhecido ou vazio",
    service_key_set: !!serviceKey,
    service_key_prefix: serviceKey ? serviceKey.substring(0, 20) + "..." : null,
    database_url_set: !!dbUrl,
    db_status: dbStatus,
    user_ids_in_db: userIds,
  });
}

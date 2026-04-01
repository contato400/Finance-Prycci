export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return Response.json({
    url_set: !!url,
    url_value: url,
    key_set: !!key,
    key_prefix: key ? key.substring(0, 20) + "..." : null,
    key_format: key?.startsWith("eyJ")
      ? "JWT (correto)"
      : key?.startsWith("sb_")
        ? "novo formato (incorreto para auth-helpers)"
        : "desconhecido",
  });
}

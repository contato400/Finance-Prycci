// Cache headers para API routes.
// s-maxage=60: CDN/Vercel cache por 60s
// stale-while-revalidate=30: serve stale enquanto revalida por +30s
export const CACHE_HEADERS = {
  "Cache-Control": "s-maxage=60, stale-while-revalidate=30",
} as const;

// Cria NextResponse.json com cache headers
import { NextResponse } from "next/server";

export function cachedJson(data: unknown) {
  return NextResponse.json(data, { headers: CACHE_HEADERS });
}

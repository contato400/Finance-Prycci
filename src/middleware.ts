import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rotas que NÃO precisam de autenticação
const publicApiPaths = ["/api/debug-env", "/api/debug-auth"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Só interceptar API routes — páginas são protegidas client-side pelo AuthSessionProvider
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // APIs públicas
  if (publicApiPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // API routes: exigir Authorization header com JWT
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Não autorizado — token ausente" }, { status: 401 });
  }

  const token = authHeader.slice(7);

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const userId = payload.sub;

    if (!userId) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return NextResponse.json({ error: "Token expirado" }, { status: 401 });
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", userId);
    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }
}

export const config = {
  matcher: ["/api/:path*"],
};

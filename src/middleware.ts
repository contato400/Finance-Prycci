import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rotas que NÃO precisam de autenticação
const publicPaths = [
  "/login", "/cadastro", "/recuperar-senha", "/pricing",
  "/api/debug-env", "/api/debug-auth",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths, static files, and root
  if (
    publicPaths.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  // For API routes, extract user from Authorization header
  if (pathname.startsWith("/api/")) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Não autorizado — token ausente" }, { status: 401 });
    }

    const token = authHeader.slice(7);

    // Decodificar o JWT para extrair o user_id sem chamar o Supabase
    // O token JWT do Supabase tem o formato: header.payload.signature
    // O payload contém o campo "sub" que é o user_id
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const userId = payload.sub;

      if (!userId) {
        return NextResponse.json({ error: "Token inválido — sem user_id" }, { status: 401 });
      }

      // Verificar se o token não expirou
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return NextResponse.json({ error: "Token expirado" }, { status: 401 });
      }

      // Propagar user_id no request header para as API routes
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-user-id", userId);
      return NextResponse.next({
        request: { headers: requestHeaders },
      });
    } catch {
      return NextResponse.json({ error: "Token inválido — falha ao decodificar" }, { status: 401 });
    }
  }

  // For app pages, check session cookie
  const hasAuthCookie = request.cookies.getAll().some(
    (c) => c.name.includes("auth-token") || c.name.includes("sb-")
  );

  if (!hasAuthCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

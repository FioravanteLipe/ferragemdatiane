import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Protege todas as páginas: quem não está logado vai para /login.
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // Sem Supabase configurado, as telas mostram um aviso de configuração.
  if (!url || !key) return NextResponse.next();

  // O leitor do celular abre sem login: quem protege é o token do QR code.
  if (request.nextUrl.pathname.startsWith("/leitor")) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const logado = Boolean(data?.claims);
  const naTelaDeLogin = request.nextUrl.pathname.startsWith("/login");

  if (!logado && !naTelaDeLogin) {
    return redirecionar(request, response, "/login");
  }
  if (logado && naTelaDeLogin) {
    return redirecionar(request, response, "/venda");
  }
  return response;
}

function redirecionar(request: NextRequest, base: NextResponse, destino: string) {
  const r = NextResponse.redirect(new URL(destino, request.url));
  base.cookies.getAll().forEach((c) => r.cookies.set(c));
  return r;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/supabase/types';

/** Tudo que dispensa sessão. */
const PUBLIC_PREFIXES = [
  '/entrar',
  '/cadastrar',
  '/recuperar-senha',
  '/nova-senha',
  '/auth',
  '/offline',
  '/configurar',
];

/**
 * Telas de entrada que não fazem sentido para quem já está autenticado.
 *
 * `/auth/*` e `/nova-senha` ficam de fora de propósito: são endpoints do
 * fluxo de e-mail e precisam rodar mesmo com sessão ativa. `/offline` também
 * — é a casca que o service worker serve quando a rede cai.
 */
const ENTRY_PAGES = ['/entrar', '/cadastrar', '/recuperar-senha'];

const matches = (list: string[], pathname: string) =>
  list.some((p) => pathname === p || pathname.startsWith(`${p}/`));

const isPublic = (pathname: string) => matches(PUBLIC_PREFIXES, pathname);

/**
 * Renova a sessão a cada request e decide quem entra onde.
 *
 * O gate de PAPEL (paciente x profissional) não mora aqui: ele fica nos
 * layouts, via `requirePatient()` / `requireProfessional()`. Assim o
 * middleware não precisa consultar o banco em toda navegação — ele só
 * responde "tem sessão?".
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Chave publicável atual, com o JWT anon legado como reserva.
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sem configuração, o app cai na tela de setup em vez de quebrar.
  if (!url || !anonKey) return response;

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Não remova: esta chamada é o que renova o token expirado.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = '/entrar';
    login.search = '';
    // Guarda o destino para voltar depois do login.
    if (pathname !== '/') login.searchParams.set('proximo', pathname + search);
    return NextResponse.redirect(login);
  }

  // Já autenticado não precisa ver login nem cadastro.
  if (user && matches(ENTRY_PAGES, pathname)) {
    const home = request.nextUrl.clone();
    home.pathname = '/';
    home.search = '';
    return NextResponse.redirect(home);
  }

  return response;
}

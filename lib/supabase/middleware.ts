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

const isPublic = (pathname: string) =>
  PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

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

  /*
    Mandar quem já tem sessão para fora do /entrar era feito aqui, e isso
    criava um laço: o middleware considera "logado" quem tem usuário no
    auth, enquanto o app exige usuário E perfil. Com um sem o outro, um
    lado mandava para /entrar e o outro devolvia para /. Agora a checagem
    mora nas próprias páginas de entrada, com a mesma definição do resto
    do app.
  */
  return response;
}

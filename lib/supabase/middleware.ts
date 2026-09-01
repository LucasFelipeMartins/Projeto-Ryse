import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/supabase/types';
import { origemParaRedirect } from '@/lib/url';
import { loginDaRota } from '@/lib/routes';

/** Tudo que dispensa sessão. */
const PUBLIC_PREFIXES = [
  '/entrar',
  '/cadastrar',
  '/recuperar-senha',
  '/nova-senha',
  '/auth',
  '/offline',
  '/configurar',
  // Portal do profissional. Precisa vir antes de qualquer regra sobre /pro:
  // a tela que cria a sessão não pode exigir sessão.
  '/pro/entrar',
  '/pro/recuperar-senha',
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
    /*
      O destino é montado a partir dos cabeçalhos do proxy, não de
      `request.nextUrl`.

      Atrás de um proxy reverso (Render, Fly, Railway, qualquer container
      atrás de um load balancer) a borda termina o TLS e encaminha para algo
      como `http://localhost:10000`. `request.nextUrl` carrega esse endereço
      interno, e redirecionar com ele mandava o navegador para `localhost` —
      o "ERR_CONNECTION_REFUSED" logo depois do login.

      Um `Location` relativo resolveria isso de forma ainda mais limpa, mas o
      middleware do Next valida a URL e recusa caminho relativo com
      `ERR_INVALID_URL`.

      `origemParaRedirect` cobre os três cenários: configuração explícita,
      cabeçalhos do proxy, e — quando nada é confiável — a própria origem da
      requisição. Esta última faz o destino ficar na mesma origem, e aí o Next
      serializa o `Location` como caminho relativo, que o navegador resolve
      corretamente. Nunca misturamos host interno com protocolo do proxy: era
      isso que gerava `https://localhost:10000`.
    */
    const origem = origemParaRedirect(request.headers, request.nextUrl.origin);

    /*
      Quem tenta abrir /pro/pacientes sem sessão vai para a entrada do
      profissional, não para a do cliente. `loginDaRota` compara o segmento
      inteiro: um `startsWith('/pro')` cru casaria com `/progresso`, que é
      tela de paciente.
    */
    const login = new URL(loginDaRota(pathname), origem);
    // Guarda o destino para voltar depois do login.
    if (pathname !== '/') login.searchParams.set('proximo', pathname + search);

    const redirect = NextResponse.redirect(login);

    /*
      Os cookies renovados por `getUser()` precisam sobreviver ao desvio. Sem
      isto, um token que acabou de ser atualizado se perderia e o próximo
      request repetiria a ida ao login.
    */
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));

    return redirect;
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

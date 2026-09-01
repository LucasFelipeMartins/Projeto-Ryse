import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

/**
 * Retorno dos links enviados por e-mail (recuperação de senha, magic link).
 * Troca o `code` do PKCE por uma sessão e segue para o destino.
 *
 * Os desvios são relativos: `new URL(request.url).origin` devolve o endereço
 * interno do processo quando o app roda atrás de um proxy, e o navegador
 * acabava em `localhost`. Caminho relativo é resolvido contra a barra de
 * endereços e acerta em qualquer hospedagem.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  if (!isSupabaseConfigured()) return redirecionar('/configurar');

  const code = searchParams.get('code');
  const nextParam = searchParams.get('proximo') ?? '/';

  // Só caminho interno — bloqueia redirect para domínio externo.
  const next =
    nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/';

  if (!code) return redirecionar('/entrar?erro=link_invalido');

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) return redirecionar('/entrar?erro=link_expirado');

  return redirecionar(next);
}

/** 303: o navegador troca o método para GET e não reenvia o `code`. */
function redirecionar(location: string) {
  return new NextResponse(null, { status: 303, headers: { Location: location } });
}

import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

/**
 * Retorno dos links enviados por e-mail (recuperação de senha, magic link).
 * Troca o `code` do PKCE por uma sessão e segue para o destino.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/configurar`);
  }

  const code = searchParams.get('code');
  const nextParam = searchParams.get('proximo') ?? '/';

  // Só caminho interno — bloqueia redirect para domínio externo.
  const next =
    nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/';

  if (!code) {
    return NextResponse.redirect(`${origin}/entrar?erro=link_invalido`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/entrar?erro=link_expirado`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}

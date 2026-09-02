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

  const nextParam = searchParams.get('proximo') ?? '/';

  // Só caminho interno — bloqueia redirect para domínio externo.
  const next =
    nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/';

  const supabase = await createClient();

  /*
    Dois formatos de link chegam aqui, e qual deles o Supabase envia depende
    do template de e-mail configurado no painel:

      ?code=…                        fluxo PKCE (`{{ .ConfirmationURL }}`)
      ?token_hash=…&type=recovery    verificação por OTP (`{{ .TokenHash }}`)

    Aceitar só o primeiro fazia o link de recuperação morrer em
    "link inválido" sempre que o template usava o segundo — sem nenhuma pista
    do porquê. Tratar os dois elimina a dependência de qual template está no
    projeto.
  */
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return redirecionar('/entrar?erro=link_expirado');
    return redirecionar(next);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as 'recovery' | 'signup' | 'email' | 'magiclink' | 'invite',
      token_hash: tokenHash,
    });
    if (error) return redirecionar('/entrar?erro=link_expirado');
    return redirecionar(next);
  }

  return redirecionar('/entrar?erro=link_invalido');
}

/** 303: o navegador troca o método para GET e não reenvia o `code`. */
function redirecionar(location: string) {
  return new NextResponse(null, { status: 303, headers: { Location: location } });
}

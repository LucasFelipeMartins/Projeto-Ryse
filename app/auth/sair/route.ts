import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

/**
 * Encerra a sessão e volta para o login.
 *
 * Existe como Route Handler porque Server Components não podem gravar
 * cookies — e é exatamente disso que `signOut()` precisa. É também a saída
 * para o estado inconsistente "existe usuário no auth, mas não existe
 * perfil": sem isso, o app ficaria repicando entre / e /entrar.
 *
 * O destino é relativo: montá-lo a partir de `request.url` levaria ao host
 * interno do processo quando há um proxy na frente.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const motivo = searchParams.get('motivo');
  // O portal de origem sobrevive ao logout, para o profissional voltar à
  // porta dele em vez de cair na do cliente.
  const portal = searchParams.get('portal');

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  const base = portal === 'profissional' ? '/pro/entrar' : '/entrar';
  const query = motivo ? `?erro=${encodeURIComponent(motivo)}` : '';

  return new NextResponse(null, {
    status: 303,
    headers: { Location: `${base}${query}` },
  });
}

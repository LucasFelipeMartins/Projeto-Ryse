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
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const motivo = searchParams.get('motivo');

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  const destino = new URL('/entrar', origin);
  if (motivo) destino.searchParams.set('erro', motivo);

  return NextResponse.redirect(destino);
}

import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

/**
 * Confirmação de e-mail após o cadastro.
 *
 * Como no callback, os desvios são relativos para não vazarem o host interno
 * do processo quando há proxy na frente.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  if (!isSupabaseConfigured()) return redirecionar('/configurar');

  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  if (!tokenHash || !type) return redirecionar('/entrar?erro=link_invalido');

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) return redirecionar('/entrar?erro=link_expirado');

  return redirecionar('/');
}

function redirecionar(location: string) {
  return new NextResponse(null, { status: 303, headers: { Location: location } });
}

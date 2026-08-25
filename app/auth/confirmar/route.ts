import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

/** Confirmação de e-mail após o cadastro. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/configurar`);
  }

  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/entrar?erro=link_invalido`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    return NextResponse.redirect(`${origin}/entrar?erro=link_expirado`);
  }

  return NextResponse.redirect(`${origin}/`);
}

import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { getSessionUser } from '@/lib/supabase/server';

/** Porta de entrada: manda cada perfil para a sua área. */
export default async function RootPage() {
  if (!isSupabaseConfigured()) redirect('/configurar');

  const user = await getSessionUser();

  if (!user) redirect('/entrar');
  redirect(user.role === 'profissional' ? '/pro' : '/inicio');
}

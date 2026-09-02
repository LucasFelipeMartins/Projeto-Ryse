import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { getSessionUser, homeFor } from '@/lib/supabase/server';

/** Porta de entrada: manda cada perfil para a sua área. */
export default async function RootPage() {
  if (!isSupabaseConfigured()) redirect('/configurar');

  const user = await getSessionUser();

  if (!user) redirect('/entrar');

  // Cliente sem onboarding nunca chega ao dashboard: o formulário vem antes.
  if (user.role === 'paciente' && !user.onboardedAt) redirect('/onboarding');

  redirect(homeFor(user.role));
}

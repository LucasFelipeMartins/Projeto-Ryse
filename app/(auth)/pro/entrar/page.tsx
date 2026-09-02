import { redirect } from 'next/navigation';
import { SignInForm } from '@/components/features/auth-forms';
import { getSessionUser, homeFor } from '@/lib/supabase/server';

export const metadata = { title: 'Entrar — Profissional' };

/**
 * Porta de entrada do profissional.
 *
 * Vive fora do grupo (shell) de propósito: /pro/* exige sessão, e a tela de
 * login não pode exigir aquilo que ela mesma cria.
 */
export default async function ProEntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string; erro?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect(homeFor(user.role));

  const { proximo, erro } = await searchParams;

  return <SignInForm portal="profissional" proximo={proximo ?? ''} erro={erro} />;
}

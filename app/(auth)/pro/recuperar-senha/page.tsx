import { redirect } from 'next/navigation';
import { ResetRequestForm } from '@/components/features/auth-forms';
import { getSessionUser, homeFor } from '@/lib/supabase/server';

export const metadata = { title: 'Recuperar senha — Profissional' };

export default async function ProRecuperarSenhaPage() {
  const user = await getSessionUser();
  if (user) redirect(homeFor(user.role));

  return <ResetRequestForm portal="profissional" />;
}

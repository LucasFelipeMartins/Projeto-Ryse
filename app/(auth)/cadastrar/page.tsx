import { redirect } from 'next/navigation';
import { SignUpForm } from '@/components/features/auth-forms';
import { getSessionUser, homeFor } from '@/lib/supabase/server';

export const metadata = { title: 'Criar conta' };

export default async function CadastrarPage() {
  const user = await getSessionUser();
  if (user) redirect(homeFor(user.role));

  return <SignUpForm />;
}

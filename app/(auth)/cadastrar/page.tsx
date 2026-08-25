import { redirect } from 'next/navigation';
import { SignUpForm } from '@/components/features/auth-forms';
import { getSessionUser } from '@/lib/supabase/server';

export const metadata = { title: 'Criar conta' };

export default async function CadastrarPage() {
  const user = await getSessionUser();
  if (user) redirect('/');

  return <SignUpForm />;
}

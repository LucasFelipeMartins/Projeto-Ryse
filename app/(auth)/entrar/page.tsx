import { redirect } from 'next/navigation';
import { SignInForm } from '@/components/features/auth-forms';
import { getSessionUser } from '@/lib/supabase/server';

export const metadata = { title: 'Entrar' };

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string; erro?: string }>;
}) {
  // A checagem de "já logado" mora aqui, e não no middleware, para usar a
  // mesma definição do resto do app: sessão E perfil. Quando as duas noções
  // divergiam, uma mandava para /entrar e a outra devolvia para /, em laço.
  const user = await getSessionUser();
  if (user) redirect('/');

  // Ler no servidor (em vez de useSearchParams) mantém o formulário
  // renderizado no servidor — sem tela em branco esperando o JS.
  const { proximo, erro } = await searchParams;

  return <SignInForm proximo={proximo ?? ''} erro={erro} />;
}

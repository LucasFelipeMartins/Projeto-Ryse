import { SignInForm } from '@/components/features/auth-forms';

export const metadata = { title: 'Entrar' };

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string; erro?: string }>;
}) {
  // Ler aqui (em vez de useSearchParams no cliente) mantém o formulário
  // renderizado no servidor — sem tela em branco esperando o JS.
  const { proximo, erro } = await searchParams;

  return <SignInForm proximo={proximo ?? ''} erro={erro} />;
}

import { VerificarEmailView } from '@/components/features/account-forms';

export const metadata = { title: 'Confirme seu e-mail' };

/**
 * Passo entre o cadastro e o primeiro acesso.
 *
 * Usa o layout de (auth)? Não — fica na raiz porque é alcançável tanto por
 * quem acabou de se cadastrar quanto por quem tentou entrar sem confirmar. O
 * e-mail chega pela query só para preencher o campo de reenvio; ele não
 * autentica nada.
 */
export default async function VerificarEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return <VerificarEmailView email={email ?? ''} />;
}

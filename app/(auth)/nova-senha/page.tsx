import { NewPasswordForm } from '@/components/features/auth-forms';

export const metadata = { title: 'Nova senha' };

/**
 * O portal chega pelo link do e-mail (`?portal=`) e decide só para onde os
 * links de "voltar" apontam. A troca de senha em si é a mesma nos dois casos.
 */
export default async function NovaSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ portal?: string }>;
}) {
  const { portal } = await searchParams;

  return (
    <NewPasswordForm portal={portal === 'profissional' ? 'profissional' : 'paciente'} />
  );
}

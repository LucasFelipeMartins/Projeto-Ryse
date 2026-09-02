import { requirePatient } from '@/lib/supabase/server';

/**
 * Área do paciente.
 *
 * `requirePatient()` é a fronteira: um profissional que digitar /inicio é
 * mandado de volta para /pro, e vice-versa. A tela do cliente não tem
 * nenhum caminho para a área administrativa.
 */
export default async function PacienteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePatient();
  return <>{children}</>;
}

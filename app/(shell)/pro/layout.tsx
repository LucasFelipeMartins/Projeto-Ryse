import { requireProfessional } from '@/lib/supabase/server';

/** Área do profissional. Paciente que tentar entrar volta para /inicio. */
export default async function ProLayout({ children }: { children: React.ReactNode }) {
  await requireProfessional();
  return <>{children}</>;
}

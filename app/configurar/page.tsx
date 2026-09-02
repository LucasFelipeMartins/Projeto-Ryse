import { redirect } from 'next/navigation';
import {
  SchemaDesatualizado,
  SetupRequired,
} from '@/components/layout/setup-required';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export const metadata = { title: 'Configuração' };

export default async function ConfigurarPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;

  /*
    Banco conectado, mas com schema antigo — `requireUser()` manda para cá com
    ?motivo=schema. É um estado diferente de "faltam as variáveis", e merece
    instrução própria: a conta está certa, o que falta é rodar a migration.
  */
  if (motivo === 'schema') return <SchemaDesatualizado />;

  // Já configurado? Então esta tela não tem motivo para existir.
  if (isSupabaseConfigured()) redirect('/');

  return <SetupRequired />;
}

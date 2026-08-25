import { redirect } from 'next/navigation';
import { SetupRequired } from '@/components/layout/setup-required';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export const metadata = { title: 'Configuração' };

export default function ConfigurarPage() {
  // Já configurado? Então esta tela não tem motivo para existir.
  if (isSupabaseConfigured()) redirect('/');
  return <SetupRequired />;
}

import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { requireUser } from '@/lib/supabase/server';

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  // Sem banco não há sessão nem dado: instrui em vez de estourar um 500.
  if (!isSupabaseConfigured()) redirect('/configurar');

  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}

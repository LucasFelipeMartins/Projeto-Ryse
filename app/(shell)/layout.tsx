import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { requireUser } from '@/lib/supabase/server';
import { getUnreadCount } from '@/lib/queries/notifications';

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  // Sem banco não há sessão nem dado: instrui em vez de estourar um 500.
  if (!isSupabaseConfigured()) redirect('/configurar');

  const user = await requireUser();

  // O contador vive no layout porque o sino aparece em toda tela. Ler aqui
  // evita que cada página repita a mesma consulta.
  const unreadCount = await getUnreadCount(user.id);

  return (
    <AppShell user={user} unreadCount={unreadCount}>
      {children}
    </AppShell>
  );
}

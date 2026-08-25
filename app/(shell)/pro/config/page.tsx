import { ConfigView } from '@/components/features/config-view';
import { requireProfessional } from '@/lib/supabase/server';

export const metadata = { title: 'Configurações' };

export default async function ConfigPage() {
  const user = await requireProfessional();
  return <ConfigView user={user} />;
}

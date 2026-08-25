import { ProgressoView } from '@/components/features/progresso-view';
import { getProgress } from '@/lib/queries/patient';
import { requirePatient } from '@/lib/supabase/server';

export const metadata = { title: 'Progresso' };

export default async function ProgressoPage() {
  const user = await requirePatient();
  const data = await getProgress(user.id);
  return <ProgressoView data={data} since={user.createdAt} />;
}

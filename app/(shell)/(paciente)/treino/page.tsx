import { TreinoView } from '@/components/features/treino-view';
import { getTraining } from '@/lib/queries/patient';
import { requirePatient } from '@/lib/supabase/server';

export const metadata = { title: 'Treino' };

export default async function TreinoPage() {
  const user = await requirePatient();
  const { plan, today, week } = await getTraining(user.id);
  return <TreinoView plan={plan} today={today} week={week} />;
}

import { redirect } from 'next/navigation';
import { SessaoView } from '@/components/features/sessao-view';
import { getTraining } from '@/lib/queries/patient';
import { requirePatient } from '@/lib/supabase/server';

export const metadata = { title: 'Sessão de treino' };

export default async function SessaoPage() {
  const user = await requirePatient();
  const { today } = await getTraining(user.id);

  // Sem ficha não há sessão para abrir.
  if (!today) redirect('/treino');

  return <SessaoView workout={today} />;
}

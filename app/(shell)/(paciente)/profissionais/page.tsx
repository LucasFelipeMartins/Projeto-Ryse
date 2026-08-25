import { ProfissionaisView } from '@/components/features/profissionais-view';
import { listProfessionals } from '@/lib/queries/professionals';
import { requirePatient } from '@/lib/supabase/server';

export const metadata = { title: 'Escolher profissional' };

export default async function ProfissionaisPage() {
  const user = await requirePatient();
  const professionals = await listProfessionals();

  return (
    <ProfissionaisView
      professionals={professionals}
      currentId={user.professionalId}
      choseSolo={user.choseSoloAt !== null}
    />
  );
}

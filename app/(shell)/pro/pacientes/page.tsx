import { PacientesView } from '@/components/features/pacientes-view';
import { getPatients } from '@/lib/queries/pro';
import { requireProfessional } from '@/lib/supabase/server';

export const metadata = { title: 'Pacientes' };

export default async function PacientesPage() {
  const pro = await requireProfessional();
  const patients = await getPatients(pro.id);
  return <PacientesView patients={patients} />;
}

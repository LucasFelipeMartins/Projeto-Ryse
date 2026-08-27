import { CheckinView } from '@/components/features/checkin-view';
import { getCheckinStatus, getLastCheckin } from '@/lib/queries/patient';
import { requirePatient } from '@/lib/supabase/server';

export const metadata = { title: 'Check-in semanal' };

export default async function CheckinPage() {
  const user = await requirePatient();

  const [last, status] = await Promise.all([
    getLastCheckin(user.id),
    // A semana é resolvida no fuso do paciente — domingo à noite em São Paulo
    // ainda pertence à semana que está terminando.
    getCheckinStatus(user.id, user.timezone),
  ]);

  return <CheckinView last={last} alreadySent={!status.pending} status={status} />;
}

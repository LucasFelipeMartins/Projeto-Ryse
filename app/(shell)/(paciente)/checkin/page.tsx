import { CheckinView } from '@/components/features/checkin-view';
import { getLastCheckin, hasCheckinThisWeek } from '@/lib/queries/patient';
import { requirePatient } from '@/lib/supabase/server';

export const metadata = { title: 'Check-in semanal' };

export default async function CheckinPage() {
  const user = await requirePatient();
  const [last, alreadySent] = await Promise.all([
    getLastCheckin(user.id),
    hasCheckinThisWeek(user.id),
  ]);

  return <CheckinView last={last} alreadySent={alreadySent} />;
}

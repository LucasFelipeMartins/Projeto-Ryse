import { PerfilView } from '@/components/features/perfil-view';
import {
  createClient,
  getLatestWeight,
  requirePatient,
} from '@/lib/supabase/server';
import { getNotificationPrefs } from '@/lib/queries/notifications';

export const metadata = { title: 'Perfil' };

export default async function PerfilPage() {
  const user = await requirePatient();
  const supabase = await createClient();

  const [prefs, latestWeightKg, { data: professional }] = await Promise.all([
    getNotificationPrefs(user.id),
    getLatestWeight(user.id),
    user.professionalId
      ? supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.professionalId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  /*
    Quantas categorias estão ligadas — o atalho de notificações mostra esse
    resumo em vez de repetir a lista inteira de interruptores no perfil.
    Com o interruptor mestre desligado, o total é zero: é o que o usuário
    de fato vai receber.
  */
  const notificationsEnabled = prefs.generalEnabled
    ? [
        prefs.workoutReminder,
        prefs.hydrationReminder,
        prefs.checkinReminder,
        prefs.reports,
        prefs.messages,
        prefs.protocolChanges,
        prefs.examResults,
      ].filter(Boolean).length
    : 0;

  return (
    <PerfilView
      user={user}
      professionalName={professional?.full_name ?? null}
      latestWeightKg={latestWeightKg}
      notificationsEnabled={notificationsEnabled}
    />
  );
}

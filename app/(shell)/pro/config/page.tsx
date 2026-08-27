import { ConfigView } from '@/components/features/config-view';
import { createClient, requireProfessional } from '@/lib/supabase/server';
import { getNotificationPrefs } from '@/lib/queries/notifications';
import { VAPID_PUBLIC_KEY } from '@/lib/notifications/push';

export const metadata = { title: 'Configurações' };

export default async function ProConfigPage() {
  const pro = await requireProfessional();
  const supabase = await createClient();

  const [prefs, { count }] = await Promise.all([
    getNotificationPrefs(pro.id),
    // Número real de pacientes vinculados — a tela antiga exibia um valor
    // fixo que nunca correspondeu a nada.
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('professional_id', pro.id)
      .eq('role', 'paciente'),
  ]);

  return (
    <ConfigView
      user={pro}
      prefs={prefs}
      patientCount={count ?? 0}
      vapidPublicKey={VAPID_PUBLIC_KEY}
    />
  );
}

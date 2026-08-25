import { PerfilView } from '@/components/features/perfil-view';
import { createClient, requirePatient } from '@/lib/supabase/server';

export const metadata = { title: 'Perfil' };

export default async function PerfilPage() {
  const user = await requirePatient();
  const supabase = await createClient();

  const [{ data: prefs }, { data: professional }] = await Promise.all([
    supabase
      .from('notification_prefs')
      .select('protocol_changes, workout_reminder, exam_results')
      .eq('profile_id', user.id)
      .maybeSingle(),
    user.professionalId
      ? supabase.from('profiles').select('full_name').eq('id', user.professionalId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <PerfilView
      user={user}
      professionalName={professional?.full_name ?? null}
      prefs={{
        protocolChanges: prefs?.protocol_changes ?? true,
        workoutReminder: prefs?.workout_reminder ?? true,
        examResults: prefs?.exam_results ?? false,
      }}
    />
  );
}

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { NotificationCategory, NotificationPrefRow } from '@/lib/supabase/types';
import type { NotificationPrefsInput } from '@/lib/actions/notifications';

export type NotificationView = {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  url: string | null;
  createdAt: string;
  read: boolean;
  /** `null` enquanto a fila não despachou. */
  sentAt: string | null;
};

/**
 * Avisos recentes do usuário.
 *
 * Inclui os que ainda não saíram para o celular: a caixa dentro do app é a
 * fonte confiável — push é entrega, não armazenamento, e um aparelho offline
 * simplesmente não recebe.
 */
export async function getNotifications(
  profileId: string,
  limit = 30,
): Promise<NotificationView[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('notifications')
    .select('id, category, title, body, url, created_at, read_at, sent_at, skip_reason')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((n) => ({
    id: n.id,
    category: n.category,
    title: n.title,
    body: n.body,
    url: n.url,
    createdAt: n.created_at,
    read: n.read_at !== null,
    sentAt: n.sent_at,
  }));
}

export async function getUnreadCount(profileId: string): Promise<number> {
  const supabase = await createClient();

  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .is('read_at', null);

  return count ?? 0;
}

/* ---------------------------------------------------------- PREFERÊNCIAS -- */

const PADRAO: NotificationPrefsInput = {
  generalEnabled: true,
  workoutReminder: true,
  hydrationReminder: true,
  checkinReminder: true,
  reports: false,
  messages: true,
  protocolChanges: true,
  examResults: false,
  quietFrom: '22:00',
  quietTo: '07:00',
};

/** `time` do Postgres chega como "22:00:00"; os selects usam "22:00". */
const hhmm = (t: string | null | undefined) => (t ?? '').slice(0, 5) || '00:00';

export async function getNotificationPrefs(
  profileId: string,
): Promise<NotificationPrefsInput> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('notification_prefs')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle();

  // Sem linha ainda (conta antiga, antes do gatilho): os padrões valem.
  if (!data) return PADRAO;

  const row = data as NotificationPrefRow;

  return {
    generalEnabled: row.general_enabled ?? true,
    workoutReminder: row.workout_reminder,
    hydrationReminder: row.hydration_reminder ?? true,
    checkinReminder: row.checkin_reminder ?? true,
    reports: row.reports ?? false,
    messages: row.messages ?? true,
    protocolChanges: row.protocol_changes,
    examResults: row.exam_results,
    quietFrom: hhmm(row.quiet_from),
    quietTo: hhmm(row.quiet_to),
  };
}

import { NotificacoesView } from '@/components/features/notificacoes-view';
import { requirePatient } from '@/lib/supabase/server';
import {
  getNotificationPrefs,
  getNotifications,
  getUnreadCount,
} from '@/lib/queries/notifications';
import { VAPID_PUBLIC_KEY } from '@/lib/notifications/push';

export const metadata = { title: 'Notificações' };

export default async function NotificacoesPage() {
  const user = await requirePatient();

  const [notifications, prefs, unread] = await Promise.all([
    getNotifications(user.id),
    getNotificationPrefs(user.id),
    getUnreadCount(user.id),
  ]);

  return (
    <NotificacoesView
      notifications={notifications}
      prefs={prefs}
      unread={unread}
      // A chave pública é lida no servidor e desce como prop: o componente de
      // cliente não precisa saber de variáveis de ambiente.
      vapidPublicKey={VAPID_PUBLIC_KEY}
    />
  );
}

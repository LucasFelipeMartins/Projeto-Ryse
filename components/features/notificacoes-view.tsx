'use client';

import Link from 'next/link';
import { useEffect, useTransition } from 'react';
import {
  Bell,
  BellRing,
  CheckCheck,
  ClipboardCheck,
  Clock,
  Droplet,
  Dumbbell,
  FileBarChart,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';
import { Badge, Card, EmptyState, PageIntro } from '@/components/ui';
import { NotificationPrefsCard } from '@/components/features/notification-prefs';
import { PushManager } from '@/components/features/push-manager';
import { marcarNotificacoesComoLidas } from '@/lib/actions/notifications';
import type { NotificationPrefsInput } from '@/lib/actions/notifications';
import type { NotificationView } from '@/lib/queries/notifications';
import type { NotificationCategory } from '@/lib/supabase/types';
import { cn, relativeTime } from '@/lib/utils';

/**
 * Central de notificações do paciente.
 *
 * Junta as três coisas que o usuário precisa quando pensa em "notificações":
 * o histórico do que chegou, o interruptor deste aparelho e as preferências
 * por categoria. Espalhá-las por telas diferentes obrigaria a caçar cada uma.
 */

const ICONE: Record<NotificationCategory, LucideIcon> = {
  geral: Bell,
  treino: Dumbbell,
  hidratacao: Droplet,
  checkin: ClipboardCheck,
  relatorio: FileBarChart,
  mensagem: MessageSquare,
};

const ROTULO: Record<NotificationCategory, string> = {
  geral: 'Geral',
  treino: 'Treino',
  hidratacao: 'Hidratação',
  checkin: 'Check-in',
  relatorio: 'Relatório',
  mensagem: 'Mensagem',
};

export function NotificacoesView({
  notifications,
  prefs,
  vapidPublicKey,
  unread,
}: {
  notifications: NotificationView[];
  prefs: NotificationPrefsInput;
  vapidPublicKey: string;
  unread: number;
}) {
  const [, startTransition] = useTransition();

  /*
    Abrir a tela é o ato de ler. Marcar na montagem — e não num botão —
    espelha o que o usuário acabou de fazer; um badge que persiste depois da
    visita vira ruído que ninguém consegue apagar.
  */
  useEffect(() => {
    if (unread > 0) {
      startTransition(() => void marcarNotificacoesComoLidas());
    }
  }, [unread]);

  return (
    <div className="space-y-6">
      <PageIntro
        title="Notificações"
        description="O que chegou, e o que você quer receber daqui em diante."
        action={
          unread > 0 ? (
            <Badge tone="brand" icon={CheckCheck} className="px-2.5 py-1 text-sm">
              {unread} {unread === 1 ? 'nova' : 'novas'}
            </Badge>
          ) : undefined
        }
      />

      <PushManager vapidPublicKey={vapidPublicKey} />

      {/* ------------------------------------------------ histórico */}
      <section>
        <h2 className="mb-3 text-base font-semibold tracking-tight">Recentes</h2>

        {notifications.length === 0 ? (
          <Card inset>
            <EmptyState
              icon={BellRing}
              title="Nada por aqui ainda"
              description="Seus lembretes de treino, hidratação e check-in vão aparecer nesta lista."
            />
          </Card>
        ) : (
          <Card inset className="divide-y divide-line overflow-hidden">
            {notifications.map((n) => {
              const Icone = ICONE[n.category];

              const conteudo = (
                <>
                  <span
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                      n.read ? 'bg-surface-2 text-muted' : 'bg-brand-soft text-brand-text',
                    )}
                  >
                    <Icone className="h-[18px] w-[18px]" aria-hidden />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span
                        className={cn(
                          'truncate text-sm',
                          n.read ? 'font-medium' : 'font-bold',
                        )}
                      >
                        {n.title}
                      </span>
                      {!n.read && (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                          aria-label="não lida"
                        />
                      )}
                    </span>

                    <span className="mt-0.5 block text-sm text-muted">{n.body}</span>

                    <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-subtle">
                      <span className="font-semibold uppercase tracking-wide">
                        {ROTULO[n.category]}
                      </span>
                      <span>{relativeTime(n.createdAt)}</span>
                      {/*
                        Enfileirada mas ainda não entregue: explicar isso evita
                        o "por que não chegou no celular?".
                      */}
                      {!n.sentAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" aria-hidden />
                          aguardando envio
                        </span>
                      )}
                    </span>
                  </span>
                </>
              );

              const classes =
                'flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2';

              return n.url ? (
                <Link key={n.id} href={n.url} className={classes}>
                  {conteudo}
                </Link>
              ) : (
                <div key={n.id} className={classes}>
                  {conteudo}
                </div>
              );
            })}
          </Card>
        )}
      </section>

      <NotificationPrefsCard initial={prefs} />
    </div>
  );
}

import 'server-only';
import webpush from 'web-push';
import { createClient } from '@/lib/supabase/server';
import type { NotificationCategory, NotificationPrefRow } from '@/lib/supabase/types';

/**
 * Envio de notificação para o celular.
 *
 * Web Push padrão (VAPID), não um serviço proprietário: funciona no Android,
 * no desktop e no iOS 16.4+ com o app na tela de início, é gratuito e não
 * amarra o projeto a um SDK de terceiro.
 *
 * Três coisas precisam ser verdade para uma notificação sair:
 *
 *   1. a categoria está ligada nas preferências do usuário;
 *   2. o horário está fora da janela de silêncio dele, no fuso dele;
 *   3. existe pelo menos um dispositivo inscrito e válido.
 *
 * Falhando qualquer uma, a linha da fila é marcada — adiada ou dispensada —
 * em vez de sumir. Notificação que desaparece sem explicação é impossível de
 * depurar depois.
 */

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:contato@ryse.app';

export const isPushConfigured = () =>
  Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

function configure(): boolean {
  if (!isPushConfigured()) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  return true;
}

/* ------------------------------------------------------- PREFERÊNCIAS ---- */

/** Coluna de `notification_prefs` que governa cada categoria. */
const COLUNA_POR_CATEGORIA: Record<NotificationCategory, keyof NotificationPrefRow> = {
  geral: 'general_enabled',
  treino: 'workout_reminder',
  hidratacao: 'hydration_reminder',
  checkin: 'checkin_reminder',
  relatorio: 'reports',
  mensagem: 'messages',
};

export function categoriaLigada(
  prefs: NotificationPrefRow | null,
  category: NotificationCategory,
): boolean {
  if (!prefs) return false;

  /*
    "Notificações gerais" é a chave mestra: desligá-la silencia tudo. Sem
    isso, o usuário teria de desmarcar seis interruptores para ter sossego.
  */
  if (!prefs.general_enabled) return false;

  return Boolean(prefs[COLUNA_POR_CATEGORIA[category]]);
}

/* ------------------------------------------------ JANELA DE SILÊNCIO ----- */

const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Minutos desde a meia-noite, no fuso informado. */
function minutosLocais(tz: string, at = new Date()): number {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(at);

  const get = (t: string) => Number(partes.find((p) => p.type === t)?.value ?? 0);
  return get('hour') * 60 + get('minute');
}

/**
 * `true` quando o horário cai na janela de silêncio.
 *
 * A janela normalmente cruza a meia-noite (22h → 7h), então a comparação é
 * feita nos dois sentidos: dentro do mesmo dia, ou "depois do início OU antes
 * do fim" quando ela vira o dia.
 */
export function emSilencio(
  prefs: Pick<NotificationPrefRow, 'quiet_from' | 'quiet_to'>,
  timezone: string,
  at = new Date(),
): boolean {
  const inicio = minutos(prefs.quiet_from);
  const fim = minutos(prefs.quiet_to);
  const agora = minutosLocais(timezone, at);

  if (inicio === fim) return false; // janela vazia
  return inicio < fim ? agora >= inicio && agora < fim : agora >= inicio || agora < fim;
}

/** Primeiro instante depois do silêncio — para reagendar em vez de descartar. */
export function proximoHorarioPermitido(
  prefs: Pick<NotificationPrefRow, 'quiet_to'>,
  timezone: string,
  at = new Date(),
): Date {
  const fim = minutos(prefs.quiet_to);
  const agora = minutosLocais(timezone, at);

  const faltam = fim > agora ? fim - agora : 24 * 60 - agora + fim;
  return new Date(at.getTime() + faltam * 60_000);
}

/* --------------------------------------------------------------- ENVIO --- */

export type PushPayload = {
  title: string;
  body: string;
  url?: string | null;
  tag?: string;
};

export type SendResult = {
  sent: number;
  removed: number;
  failed: number;
};

/**
 * Entrega a um usuário, em todos os dispositivos inscritos.
 *
 * Inscrição que responde 404 ou 410 morreu do outro lado — o app foi
 * desinstalado, ou o navegador limpou os dados. Marcar como expirada evita
 * insistir em endpoint morto a cada disparo.
 */
export async function enviarPush(
  profileId: string,
  payload: PushPayload,
): Promise<SendResult> {
  if (!configure()) return { sent: 0, removed: 0, failed: 0 };

  const supabase = await createClient();

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('profile_id', profileId)
    .is('expired_at', null);

  if (!subs?.length) return { sent: 0, removed: 0, failed: 0 };

  const corpo = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/',
    tag: payload.tag,
  });

  let sent = 0;
  let removed = 0;
  let failed = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          corpo,
          { TTL: 60 * 60 * 12 },
        );
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;

        if (status === 404 || status === 410) {
          await supabase
            .from('push_subscriptions')
            .update({ expired_at: new Date().toISOString() })
            .eq('id', sub.id);
          removed += 1;
        } else {
          failed += 1;
        }
      }
    }),
  );

  return { sent, removed, failed };
}

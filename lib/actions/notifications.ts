'use server';

import { revalidatePath } from 'next/cache';
import { createClient, requireUser } from '@/lib/supabase/server';
import { enviarPush, isPushConfigured } from '@/lib/notifications/push';
import type { ActionResult } from '@/lib/types';
import type { NotificationCategory } from '@/lib/supabase/types';

/**
 * Dispositivos e preferências de notificação.
 *
 * O registro do dispositivo é idempotente: o mesmo navegador devolve o mesmo
 * endpoint, então reabrir o app atualiza `last_seen_at` em vez de criar linha
 * nova. Se o endpoint tinha sido marcado como expirado e voltou, a marca é
 * limpa — é o mesmo aparelho reinstalado.
 */

export type NotificationPrefsInput = {
  generalEnabled: boolean;
  workoutReminder: boolean;
  hydrationReminder: boolean;
  checkinReminder: boolean;
  reports: boolean;
  messages: boolean;
  protocolChanges: boolean;
  examResults: boolean;
  quietFrom: string;
  quietTo: string;
};

const HORA_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/* ----------------------------------------------------------- DISPOSITIVO -- */

export async function registrarDispositivo(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}): Promise<ActionResult> {
  const user = await requireUser();

  if (!input.endpoint.startsWith('https://')) {
    return { ok: false, error: 'Inscrição de push inválida.' };
  }
  if (!input.p256dh || !input.auth) {
    return { ok: false, error: 'Faltam as chaves de criptografia da inscrição.' };
  }

  const supabase = await createClient();
  const agora = new Date().toISOString();

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      profile_id: user.id,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent?.slice(0, 300) ?? null,
      last_seen_at: agora,
      // Reinstalou o app: a inscrição volta a valer.
      expired_at: null,
    },
    { onConflict: 'endpoint' },
  );

  if (error) {
    return { ok: false, error: 'Não foi possível registrar este dispositivo.' };
  }

  revalidatePath('/perfil');
  return { ok: true };
}

export async function removerDispositivo(endpoint: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('profile_id', user.id);

  if (error) return { ok: false, error: 'Não foi possível remover o dispositivo.' };

  revalidatePath('/perfil');
  return { ok: true };
}

/** Notificação de teste — confirma que a permissão e as chaves funcionam. */
export async function enviarNotificacaoDeTeste(): Promise<ActionResult> {
  const user = await requireUser();

  if (!isPushConfigured()) {
    return {
      ok: false,
      error: 'O envio para celular ainda não está configurado nesta instalação.',
    };
  }

  const resultado = await enviarPush(user.id, {
    title: 'Ryse',
    body: 'Tudo certo — é assim que os lembretes vão chegar.',
    url: '/inicio',
    tag: 'teste',
  });

  if (resultado.sent === 0) {
    return {
      ok: false,
      error:
        resultado.removed > 0
          ? 'A inscrição deste aparelho expirou. Ative as notificações de novo.'
          : 'Nenhum dispositivo ativo. Ative as notificações neste aparelho.',
    };
  }

  return { ok: true };
}

/* ---------------------------------------------------------- PREFERÊNCIAS -- */

export async function salvarPreferenciasDeNotificacao(
  input: NotificationPrefsInput,
): Promise<ActionResult> {
  const user = await requireUser();

  if (!HORA_RE.test(input.quietFrom) || !HORA_RE.test(input.quietTo)) {
    return { ok: false, error: 'Horário de silêncio inválido.' };
  }

  const supabase = await createClient();

  const { error } = await supabase.from('notification_prefs').upsert(
    {
      profile_id: user.id,
      general_enabled: input.generalEnabled,
      workout_reminder: input.workoutReminder,
      hydration_reminder: input.hydrationReminder,
      checkin_reminder: input.checkinReminder,
      reports: input.reports,
      messages: input.messages,
      protocol_changes: input.protocolChanges,
      exam_results: input.examResults,
      quiet_from: input.quietFrom,
      quiet_to: input.quietTo,
    },
    { onConflict: 'profile_id' },
  );

  if (error) {
    return { ok: false, error: 'Não foi possível salvar as preferências.' };
  }

  revalidatePath('/perfil');
  revalidatePath('/pro/config');
  return { ok: true };
}

/** Fuso do usuário, detectado pelo navegador. Base de tudo que é agendado. */
export async function salvarFusoHorario(timezone: string): Promise<ActionResult> {
  const user = await requireUser();

  // Uma string arbitrária aqui quebraria todo Intl que a use depois.
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone });
  } catch {
    return { ok: false, error: 'Fuso horário inválido.' };
  }

  if (timezone === user.timezone) return { ok: true };

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ timezone })
    .eq('id', user.id);

  if (error) return { ok: false, error: 'Não foi possível salvar o fuso.' };
  return { ok: true };
}

/* --------------------------------------------------------- AGENDAMENTO ---- */

/**
 * Enfileira uma notificação.
 *
 * A checagem de preferência e de silêncio acontece no despacho, não aqui: o
 * usuário pode mudar as configurações entre o agendamento e a hora do envio,
 * e o que vale é a preferência no momento de entregar.
 */
export async function agendarNotificacao(input: {
  profileId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  url?: string;
  scheduledFor?: Date;
}): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.from('notifications').insert({
    profile_id: input.profileId,
    category: input.category,
    title: input.title.slice(0, 120),
    body: input.body.slice(0, 300),
    url: input.url ?? null,
    scheduled_for: (input.scheduledFor ?? new Date()).toISOString(),
  });

  // A RLS decide se o remetente podia avisar este destinatário.
  if (error) return { ok: false, error: 'Não foi possível agendar o aviso.' };

  return { ok: true };
}

/** Marca as notificações do usuário como lidas. */
export async function marcarNotificacoesComoLidas(): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('profile_id', user.id)
    .is('read_at', null);

  if (error) return { ok: false, error: 'Não foi possível atualizar.' };

  revalidatePath('/', 'layout');
  return { ok: true };
}

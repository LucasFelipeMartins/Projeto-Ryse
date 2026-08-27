import 'server-only';
import webpush from 'web-push';
import { createAdminClient, isAdminConfigured } from '@/lib/supabase/admin';
import {
  categoriaLigada,
  emSilencio,
  isPushConfigured,
  proximoHorarioPermitido,
  VAPID_PUBLIC_KEY,
} from '@/lib/notifications/push';
import type {
  NotificationCategory,
  NotificationPrefRow,
} from '@/lib/supabase/types';

/**
 * Despacho da fila de notificações.
 *
 * Roda fora de qualquer sessão (cron), então usa o cliente administrativo —
 * é a única parte do app que ignora a RLS, e é por isso que a rota que a
 * chama exige um segredo.
 *
 * Para cada item vencido, a decisão é uma de três:
 *
 *   enviar   — a categoria está ligada e o horário é permitido;
 *   adiar    — está na janela de silêncio: reagenda para o fim dela;
 *   dispensar— a categoria está desligada: marca o motivo e não volta mais.
 *
 * Dispensar com motivo registrado, em vez de apagar, é o que permite
 * responder depois à pergunta "por que não recebi o lembrete de ontem?".
 */

const LOTE = 200;

export type DispatchSummary = {
  processadas: number;
  enviadas: number;
  adiadas: number;
  dispensadas: number;
  semDispositivo: number;
};

type Pendente = {
  id: string;
  profile_id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  url: string | null;
};

export async function despacharNotificacoes(): Promise<DispatchSummary> {
  const vazio: DispatchSummary = {
    processadas: 0,
    enviadas: 0,
    adiadas: 0,
    dispensadas: 0,
    semDispositivo: 0,
  };

  if (!isAdminConfigured() || !isPushConfigured()) return vazio;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:contato@ryse.app',
    VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY ?? '',
  );

  const supabase = createAdminClient();
  const agora = new Date();

  const { data: pendentes } = await supabase
    .from('notifications')
    .select('id, profile_id, category, title, body, url')
    .is('sent_at', null)
    .is('skip_reason', null)
    .lte('scheduled_for', agora.toISOString())
    .order('scheduled_for')
    .limit(LOTE);

  if (!pendentes?.length) return vazio;

  const destinatarios = [...new Set(pendentes.map((n) => n.profile_id))];

  // Preferências, fusos e dispositivos de todos os destinatários de uma vez —
  // uma consulta por tabela, não uma por notificação.
  const [{ data: prefsRows }, { data: perfis }, { data: inscricoes }] =
    await Promise.all([
      supabase.from('notification_prefs').select('*').in('profile_id', destinatarios),
      supabase.from('profiles').select('id, timezone').in('id', destinatarios),
      supabase
        .from('push_subscriptions')
        .select('id, profile_id, endpoint, p256dh, auth')
        .in('profile_id', destinatarios)
        .is('expired_at', null),
    ]);

  const prefsPor = new Map<string, NotificationPrefRow>(
    (prefsRows ?? []).map((p) => [p.profile_id, p]),
  );
  const fusoPor = new Map<string, string>(
    (perfis ?? []).map((p) => [p.id, p.timezone ?? 'America/Sao_Paulo']),
  );
  const devicesPor = new Map<string, typeof inscricoes>();
  for (const sub of inscricoes ?? []) {
    const lista = devicesPor.get(sub.profile_id) ?? [];
    lista.push(sub);
    devicesPor.set(sub.profile_id, lista);
  }

  const resumo = { ...vazio, processadas: pendentes.length };

  for (const item of pendentes as Pendente[]) {
    const prefs = prefsPor.get(item.profile_id) ?? null;
    const fuso = fusoPor.get(item.profile_id) ?? 'America/Sao_Paulo';

    if (!categoriaLigada(prefs, item.category)) {
      await supabase
        .from('notifications')
        .update({ skip_reason: 'categoria desativada pelo usuário' })
        .eq('id', item.id);
      resumo.dispensadas += 1;
      continue;
    }

    /*
      Mensagem de pessoa não espera o fim do silêncio — quem escreveu está do
      outro lado aguardando resposta. Lembretes automáticos, sim.
    */
    if (
      prefs &&
      item.category !== 'mensagem' &&
      emSilencio(prefs, fuso, agora)
    ) {
      await supabase
        .from('notifications')
        .update({
          scheduled_for: proximoHorarioPermitido(prefs, fuso, agora).toISOString(),
        })
        .eq('id', item.id);
      resumo.adiadas += 1;
      continue;
    }

    const devices = devicesPor.get(item.profile_id) ?? [];

    if (devices.length === 0) {
      await supabase
        .from('notifications')
        .update({ skip_reason: 'nenhum dispositivo inscrito' })
        .eq('id', item.id);
      resumo.semDispositivo += 1;
      continue;
    }

    const corpo = JSON.stringify({
      title: item.title,
      body: item.body,
      url: item.url ?? '/',
      tag: `${item.category}-${item.id}`,
    });

    let entregou = false;

    for (const device of devices) {
      try {
        await webpush.sendNotification(
          {
            endpoint: device.endpoint,
            keys: { p256dh: device.p256dh, auth: device.auth },
          },
          corpo,
          { TTL: 60 * 60 * 12 },
        );
        entregou = true;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await supabase
            .from('push_subscriptions')
            .update({ expired_at: new Date().toISOString() })
            .eq('id', device.id);
        }
      }
    }

    if (entregou) {
      await supabase
        .from('notifications')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', item.id);
      resumo.enviadas += 1;
    } else {
      // Todos os endpoints falharam: dispensa com motivo, para não ficar
      // reprocessando a mesma linha a cada minuto.
      await supabase
        .from('notifications')
        .update({ skip_reason: 'falha na entrega em todos os dispositivos' })
        .eq('id', item.id);
      resumo.semDispositivo += 1;
    }
  }

  return resumo;
}

/* ------------------------------------------------------ LEMBRETES DIÁRIOS - */

export type ReminderSummary = { hidratacao: number; treino: number; checkin: number };

/**
 * Gera os lembretes recorrentes do dia.
 *
 * Idempotente por construção: antes de enfileirar, consulta o que já foi
 * criado para aquele usuário, naquela categoria, nas últimas horas. O cron
 * pode rodar de hora em hora sem duplicar nada.
 */
export async function gerarLembretes(): Promise<ReminderSummary> {
  const resumo: ReminderSummary = { hidratacao: 0, treino: 0, checkin: 0 };

  if (!isAdminConfigured()) return resumo;

  const supabase = createAdminClient();
  const agora = new Date();

  const { data: pacientes } = await supabase
    .from('profiles')
    .select('id, timezone, training_days')
    .eq('role', 'paciente')
    .not('onboarded_at', 'is', null);

  if (!pacientes?.length) return resumo;

  const ids = pacientes.map((p) => p.id);

  // Já enfileirado hoje? Uma consulta cobre todos os usuários e categorias.
  const desde = new Date(agora.getTime() - 20 * 3600 * 1000).toISOString();
  const { data: recentes } = await supabase
    .from('notifications')
    .select('profile_id, category')
    .in('profile_id', ids)
    .gte('created_at', desde);

  const jaTem = new Set(
    (recentes ?? []).map((r) => `${r.profile_id}:${r.category}`),
  );

  const { data: prefsRows } = await supabase
    .from('notification_prefs')
    .select('*')
    .in('profile_id', ids);

  const prefsPor = new Map<string, NotificationPrefRow>(
    (prefsRows ?? []).map((p) => [p.profile_id, p]),
  );

  const novas: {
    profile_id: string;
    category: NotificationCategory;
    title: string;
    body: string;
    url: string;
    scheduled_for: string;
  }[] = [];

  for (const paciente of pacientes) {
    const prefs = prefsPor.get(paciente.id) ?? null;
    if (!prefs?.general_enabled) continue;

    const fuso = paciente.timezone ?? 'America/Sao_Paulo';
    const hora = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: fuso,
        hour: '2-digit',
        hour12: false,
      }).format(agora),
    );

    // Hidratação: no meio da tarde, quando ainda dá tempo de recuperar o dia.
    if (
      prefs.hydration_reminder &&
      hora >= 15 &&
      hora < 19 &&
      !jaTem.has(`${paciente.id}:hidratacao`)
    ) {
      novas.push({
        profile_id: paciente.id,
        category: 'hidratacao',
        title: 'Como está sua hidratação?',
        body: 'Registre o que você bebeu hoje e veja quanto falta para a meta.',
        url: '/inicio',
        scheduled_for: agora.toISOString(),
      });
      resumo.hidratacao += 1;
    }

    // Treino: no começo da noite, antes de o dia acabar.
    if (
      prefs.workout_reminder &&
      (paciente.training_days ?? 0) > 0 &&
      hora >= 17 &&
      hora < 21 &&
      !jaTem.has(`${paciente.id}:treino`)
    ) {
      novas.push({
        profile_id: paciente.id,
        category: 'treino',
        title: 'Treino de hoje',
        body: 'Sua ficha está pronta. Abrir a sessão leva um toque.',
        url: '/treino',
        scheduled_for: agora.toISOString(),
      });
      resumo.treino += 1;
    }
  }

  /*
    Check-in: só para quem realmente está devendo a semana. A consulta usa a
    função do banco, que resolve a semana no fuso de cada paciente.
  */
  if (novas.length < 500) {
    for (const paciente of pacientes) {
      const prefs = prefsPor.get(paciente.id);
      if (!prefs?.general_enabled || !prefs.checkin_reminder) continue;
      if (jaTem.has(`${paciente.id}:checkin`)) continue;

      const fuso = paciente.timezone ?? 'America/Sao_Paulo';
      const partes = new Intl.DateTimeFormat('en-GB', {
        timeZone: fuso,
        weekday: 'short',
        hour: '2-digit',
        hour12: false,
      }).formatToParts(agora);

      const diaDaSemana = partes.find((p) => p.type === 'weekday')?.value;
      const hora = Number(partes.find((p) => p.type === 'hour')?.value ?? 0);

      // Lembra na segunda de manhã e cobra de novo no domingo à tarde.
      const momentoBom =
        (diaDaSemana === 'Mon' && hora >= 9 && hora < 12) ||
        (diaDaSemana === 'Sun' && hora >= 15 && hora < 19);

      if (!momentoBom) continue;

      const { data: pendente } = await supabase.rpc('checkin_pending', {
        target_patient: paciente.id,
      });

      if (!pendente) continue;

      novas.push({
        profile_id: paciente.id,
        category: 'checkin',
        title: 'Seu check-in está pendente',
        body: 'Dois minutos agora deixam sua semana toda calibrada.',
        url: '/checkin',
        scheduled_for: agora.toISOString(),
      });
      resumo.checkin += 1;
    }
  }

  if (novas.length > 0) {
    await supabase.from('notifications').insert(novas);
  }

  return resumo;
}

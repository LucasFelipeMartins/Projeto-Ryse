import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { AiRequestKind } from '@/lib/supabase/types';
import { APP_TIMEZONE } from '@/lib/utils';

/**
 * Limites de uso da IA.
 *
 * O controle é do servidor, e não por contagem otimista: a garantia real vem
 * do índice único `(profile_id, kind, period_key)` em `ai_usage`. A Server
 * Action **reserva** a linha antes de chamar o provedor; se duas abas
 * tentarem ao mesmo tempo, a segunda esbarra na unicidade e recebe a
 * mensagem de limite. Um `select count(*)` seguido de `insert` deixaria essa
 * corrida aberta.
 *
 * Se a chamada falhar, a reserva é devolvida — ninguém perde a cota do mês
 * por causa de um timeout do provedor.
 */

export type Window = 'mes' | 'semana';

type Rule = { window: Window; max: number; label: string };

export const AI_LIMITS: Record<AiRequestKind, Rule> = {
  dieta: { window: 'mes', max: 1, label: 'Criar dieta com IA' },
  ficha_treino: { window: 'mes', max: 1, label: 'Criar ficha de treino com IA' },
  relatorio_nutricao: { window: 'mes', max: 1, label: 'Relatório de nutrição' },
  relatorio_treino: { window: 'mes', max: 1, label: 'Relatório de treino' },
  relatorio_saude: { window: 'mes', max: 1, label: 'Relatório de saúde' },
  relatorio_exames: { window: 'semana', max: 1, label: 'Relatório de exames' },
  analise_protocolo: { window: 'semana', max: 1, label: 'Análise do protocolo' },
};

/* ------------------------------------------------------------- PERÍODOS -- */

/** Partes da data no fuso do usuário — a janela é a dele, não a do servidor. */
function zoned(tz: string, at = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** Segunda-feira da semana da data, em UTC-noon para evitar borda de fuso. */
function mondayOf(date: Date): Date {
  const d = new Date(date);
  const weekday = (d.getUTCDay() + 6) % 7; // 0 = segunda
  d.setUTCDate(d.getUTCDate() - weekday);
  return d;
}

/**
 * Chave da janela corrente.
 *   mensal  -> "2026-08"
 *   semanal -> "2026-W35" (semana ISO, começando na segunda)
 */
export function periodKey(window: Window, tz = APP_TIMEZONE, at = new Date()): string {
  const { year, month, day } = zoned(tz, at);
  if (window === 'mes') return `${year}-${String(month).padStart(2, '0')}`;

  const monday = mondayOf(new Date(Date.UTC(year, month - 1, day, 12)));
  // Semana ISO: a quinta-feira da semana define o ano.
  const thursday = new Date(monday);
  thursday.setUTCDate(thursday.getUTCDate() + 3);

  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4, 12));
  const week =
    1 +
    Math.round(
      (mondayOf(thursday).getTime() - mondayOf(firstThursday).getTime()) /
        (7 * 24 * 3600 * 1000),
    );

  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Quando a cota vira de novo — usado na mensagem ao usuário. */
export function nextResetAt(window: Window, tz = APP_TIMEZONE, at = new Date()): Date {
  const { year, month, day } = zoned(tz, at);

  if (window === 'mes') {
    return new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1, 3));
  }

  const monday = mondayOf(new Date(Date.UTC(year, month - 1, day, 12)));
  monday.setUTCDate(monday.getUTCDate() + 7);
  monday.setUTCHours(3, 0, 0, 0);
  return monday;
}

export function formatReset(date: Date, tz = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: tz,
    day: '2-digit',
    month: 'long',
  }).format(date);
}

/* -------------------------------------------------------------- RESERVA -- */

export type Reservation =
  | { ok: true; id: string }
  | { ok: false; error: string; availableAt: string };

/** Mensagem que a interface mostra quando a cota acabou. */
export function limitMessage(kind: AiRequestKind, tz = APP_TIMEZONE): string {
  const rule = AI_LIMITS[kind];
  const quando = formatReset(nextResetAt(rule.window, tz), tz);
  const janela = rule.window === 'mes' ? 'mensal' : 'semanal';

  return `Você atingiu o limite ${janela} de "${rule.label}". A próxima solicitação fica disponível em ${quando}.`;
}

/**
 * Reserva uma execução antes de chamar o provedor.
 *
 * O erro 23505 (unique_violation) é o próprio limite falando: já existe
 * registro para esse usuário, essa ação e essa janela.
 */
export async function reserveAiRun(input: {
  profileId: string;
  patientId: string;
  kind: AiRequestKind;
  timezone?: string;
}): Promise<Reservation> {
  const tz = input.timezone ?? APP_TIMEZONE;
  const rule = AI_LIMITS[input.kind];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('ai_usage')
    .insert({
      profile_id: input.profileId,
      patient_id: input.patientId,
      kind: input.kind,
      period_key: periodKey(rule.window, tz),
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        error: limitMessage(input.kind, tz),
        availableAt: nextResetAt(rule.window, tz).toISOString(),
      };
    }
    return {
      ok: false,
      error: 'Não foi possível iniciar a análise agora. Tente novamente.',
      availableAt: new Date().toISOString(),
    };
  }

  return { ok: true, id: data.id };
}

/**
 * Marca a reserva como concluída e a liga ao resultado salvo.
 *
 * Vai por RPC, não por UPDATE direto: o usuário não tem permissão de escrita
 * em `ai_usage` depois do INSERT. Se tivesse, poderia mexer em `period_key`
 * e liberar o índice único — ou seja, furar o próprio limite.
 */
export async function completeAiRun(reservationId: string, outputId: string | null) {
  const supabase = await createClient();
  await supabase.rpc('complete_ai_reservation', {
    reservation: reservationId,
    output: outputId,
  });
}

/**
 * Devolve a cota depois de uma falha.
 *
 * A reserva é **apagada**, não marcada como falha. Guardar a linha exigiria
 * que a contagem ignorasse certo status — e um status que a contagem ignora é
 * exatamente o que um cliente mal-intencionado tentaria forjar. Sem linha, a
 * janela volta a ficar livre pelo próprio índice único.
 *
 * O motivo vai para o log do servidor, que é onde se diagnostica provedor
 * instável sem abrir brecha no limite.
 */
export async function releaseAiRun(reservationId: string, reason: string) {
  const supabase = await createClient();
  console.error('[ia] reserva devolvida:', reservationId, reason.slice(0, 300));
  await supabase.rpc('release_ai_reservation', { reservation: reservationId });
}

/* ---------------------------------------------------------------- STATUS -- */

export type QuotaStatus = {
  kind: AiRequestKind;
  used: boolean;
  label: string;
  window: Window;
  /** Data legível em que a cota volta. Só faz sentido quando `used`. */
  availableOn: string;
};

/**
 * Situação da cota de várias ações de uma vez — a interface usa isso para
 * desabilitar o botão e explicar o porquê **antes** do clique.
 */
export async function getQuotaStatus(
  profileId: string,
  kinds: AiRequestKind[],
  timezone = APP_TIMEZONE,
): Promise<Record<string, QuotaStatus>> {
  const supabase = await createClient();

  const keys = [...new Set(kinds.map((k) => periodKey(AI_LIMITS[k].window, timezone)))];

  const { data } = await supabase
    .from('ai_usage')
    .select('kind, period_key')
    .eq('profile_id', profileId)
    .in('kind', kinds)
    .in('period_key', keys);

  /*
    Existir linha já significa cota usada. Não há filtro por status porque
    execução que falhou é apagada em `releaseAiRun` — o que elimina qualquer
    valor de status que o cliente pudesse forjar para se dar mais cota.
  */
  const usados = new Set((data ?? []).map((r) => `${r.kind}:${r.period_key}`));

  const status: Record<string, QuotaStatus> = {};

  for (const kind of kinds) {
    const rule = AI_LIMITS[kind];
    const key = periodKey(rule.window, timezone);
    status[kind] = {
      kind,
      used: usados.has(`${kind}:${key}`),
      label: rule.label,
      window: rule.window,
      availableOn: formatReset(nextResetAt(rule.window, timezone), timezone),
    };
  }

  return status;
}

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { relativeTime, weekStartISO } from '@/lib/utils';
import type { Tone } from '@/lib/types';
import type {
  Json,
  MarkerStatus,
  PaymentStatus,
  PlanTier,
  ProtocolKind,
  ReviewModule,
  ReviewStatus,
  ReviewUrgency,
} from '@/lib/supabase/types';

export type { Tone } from '@/lib/types';

const PLAN_LABEL: Record<PlanTier, string> = {
  completo: 'Ryse Completo',
  nutricao: 'Ryse Nutrição',
  treino: 'Ryse Treino',
};

const MODULE_LABEL: Record<ReviewModule, string> = {
  nutricao: 'Nutrição',
  treino: 'Treino',
  suplementacao: 'Suplementação',
};

const PAYMENT_TONE: Record<PaymentStatus, Tone> = {
  pago: 'success',
  pendente: 'warn',
  falhou: 'danger',
  estornado: 'neutral',
};

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  pago: 'Pago',
  pendente: 'Pendente',
  falhou: 'Falhou',
  estornado: 'Estornado',
};

/* ------------------------------------------------------------ VIEW MODELS */

export type PatientRowView = {
  id: string;
  name: string;
  /** Foto de perfil do paciente. `null` cai nas iniciais. */
  avatarUrl: string | null;
  email: string;
  plan: string;
  goal: string;
  status: string;
  tone: Tone;
  adherence: number;
  weight: number | null;
  lastCheckin: string;
};

export type ReviewView = {
  id: string;
  patientId: string;
  patient: string;
  module: string;
  urgency: ReviewUrgency;
  status: ReviewStatus;
  confidence: number;
  trigger: string;
  summary: string;
  rationale: string;
  action: string;
  sources: string[];
  age: string;
  before: DiffSide;
  after: DiffSide;
};

export type DiffSide = {
  title: string;
  lines: string[];
  kcal: number;
  macros: string;
};

/** `before_state`/`after_state` vêm como jsonb; normaliza com defaults. */
function toDiffSide(value: Json, fallbackTitle: string): DiffSide {
  const obj = (value ?? {}) as Record<string, unknown>;
  return {
    title: typeof obj.title === 'string' ? obj.title : fallbackTitle,
    lines: Array.isArray(obj.lines) ? obj.lines.map(String) : [],
    kcal: typeof obj.kcal === 'number' ? obj.kcal : 0,
    macros: typeof obj.macros === 'string' ? obj.macros : '',
  };
}

/* ------------------------------------------------------------- PACIENTES */

export async function getPatients(professionalId: string): Promise<PatientRowView[]> {
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email, plan, goal, avatar_url')
    .eq('professional_id', professionalId)
    .eq('role', 'paciente')
    .order('full_name');

  const ids = (profiles ?? []).map((p) => p.id);
  if (ids.length === 0) return [];

  // Último check-in e último peso de todos os pacientes em duas consultas,
  // em vez de N+1.
  const [{ data: checkins }, { data: metrics }, { data: pendingReviews }] =
    await Promise.all([
      supabase
        .from('checkins')
        .select('patient_id, adherence, created_at')
        .in('patient_id', ids)
        .order('created_at', { ascending: false }),
      supabase
        .from('body_metrics')
        .select('patient_id, weight_kg, measured_on')
        .in('patient_id', ids)
        .order('measured_on', { ascending: false }),
      supabase
        .from('ai_reviews')
        .select('patient_id, urgency')
        .in('patient_id', ids)
        .eq('status', 'pendente'),
    ]);

  const latestCheckin = new Map<string, { adherence: number | null; at: string }>();
  for (const c of checkins ?? []) {
    if (!latestCheckin.has(c.patient_id)) {
      latestCheckin.set(c.patient_id, { adherence: c.adherence, at: c.created_at });
    }
  }

  const latestWeight = new Map<string, number | null>();
  for (const m of metrics ?? []) {
    if (!latestWeight.has(m.patient_id)) latestWeight.set(m.patient_id, m.weight_kg);
  }

  const pendingByPatient = new Map<string, ReviewUrgency>();
  for (const r of pendingReviews ?? []) {
    // Prioridade alta prevalece sobre média.
    if (r.urgency === 'alta' || !pendingByPatient.has(r.patient_id)) {
      pendingByPatient.set(r.patient_id, r.urgency);
    }
  }

  return (profiles ?? []).map((p) => {
    const check = latestCheckin.get(p.id);
    const adherence = check?.adherence ? check.adherence * 20 : 0;
    const pending = pendingByPatient.get(p.id);

    let status = 'Estável';
    let tone: Tone = 'success';

    if (pending === 'alta') {
      status = 'Prioridade clínica';
      tone = 'danger';
    } else if (pending === 'media') {
      status = 'Revisão pendente';
      tone = 'warn';
    } else if (!check) {
      status = 'Aguardando check-in';
      tone = 'neutral';
    } else if (adherence < 70) {
      status = 'Baixa adesão';
      tone = 'danger';
    }

    return {
      id: p.id,
      name: p.full_name,
      avatarUrl: p.avatar_url,
      email: p.email,
      plan: p.plan ? PLAN_LABEL[p.plan] : 'Sem plano',
      goal: p.goal ?? '—',
      status,
      tone,
      adherence: Math.round(adherence),
      weight: latestWeight.get(p.id) ?? null,
      lastCheckin: check ? relativeTime(check.at) : 'nunca',
    };
  });
}

/* --------------------------------------------------------------- PAINEL --- */

export async function getDashboard(professionalId: string) {
  const supabase = await createClient();

  const [
    { count: activePatients },
    { count: pendingCount },
    { data: checkins },
    { data: subs },
    { data: reviews },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('professional_id', professionalId)
      .eq('role', 'paciente'),
    supabase
      .from('ai_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('professional_id', professionalId)
      .eq('status', 'pendente'),
    supabase
      .from('checkins')
      .select('adherence, week_start, patient_id')
      .gte('week_start', shiftWeeks(weekStartISO(), -7))
      .order('week_start'),
    // Continua sendo lido para uso interno; a interface do profissional
    // apenas não expõe mais o número.
    supabase.from('subscriptions').select('amount_cents').eq('is_active', true),
    supabase
      .from('ai_reviews')
      .select('created_at')
      .eq('professional_id', professionalId)
      .gte('created_at', `${shiftWeeks(weekStartISO(), -7)}T00:00:00`),
  ]);

  // Adesão média (1-5 vira %), agrupada por semana.
  const byWeek = new Map<string, number[]>();
  for (const c of checkins ?? []) {
    if (c.adherence === null) continue;
    const list = byWeek.get(c.week_start) ?? [];
    list.push(c.adherence * 20);
    byWeek.set(c.week_start, list);
  }

  const weeks = Array.from({ length: 8 }, (_, i) => shiftWeeks(weekStartISO(), i - 7));

  const adherenceSeries = weeks.map((w) => {
    const values = byWeek.get(w) ?? [];
    if (values.length === 0) return 0;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  });

  // Intervenções da IA por semana.
  const interventions = weeks.map((w) => {
    const start = new Date(`${w}T00:00:00`).getTime();
    const end = start + 7 * 86400000;
    return (reviews ?? []).filter((r) => {
      const t = new Date(r.created_at).getTime();
      return t >= start && t < end;
    }).length;
  });

  const mrrCents = (subs ?? []).reduce((sum, s) => sum + s.amount_cents, 0);

  /*
    Check-ins pendentes da semana corrente.

    Substituiu o MRR no painel: faturamento saiu da interface do
    profissional, e o que ele precisa ver ali é quem ainda não respondeu —
    é a informação sobre a qual ele consegue agir hoje.

    Conta quem NÃO tem linha na semana atual, então parte da lista de
    pacientes e subtrai os que já enviaram.
  */
  const semanaAtual = weekStartISO();
  const { data: meusPacientes } = await supabase
    .from('profiles')
    .select('id')
    .eq('professional_id', professionalId)
    .eq('role', 'paciente');

  const idsPacientes = (meusPacientes ?? []).map((p) => p.id);

  let pendingCheckins = 0;

  if (idsPacientes.length > 0) {
    const { data: enviados } = await supabase
      .from('checkins')
      .select('patient_id')
      .eq('week_start', semanaAtual)
      .in('patient_id', idsPacientes);

    const emDia = new Set((enviados ?? []).map((c) => c.patient_id));
    pendingCheckins = idsPacientes.filter((id) => !emDia.has(id)).length;
  }

  const allAdherence = adherenceSeries.filter((n) => n > 0);
  const avgAdherence =
    allAdherence.length > 0
      ? Math.round(allAdherence.reduce((a, b) => a + b, 0) / allAdherence.length)
      : 0;

  return {
    kpis: {
      activePatients: activePatients ?? 0,
      pendingReviews: pendingCount ?? 0,
      avgAdherence,
      pendingCheckins,
      // Continua calculado para uso interno (relatórios, administração).
      // A tela do profissional não o exibe mais.
      mrrCents,
    },
    weekLabels: weeks.map((_, i) => `S${i + 1}`),
    adherenceSeries,
    interventions,
  };
}

/** Soma (ou subtrai) semanas de uma data YYYY-MM-DD. */
function shiftWeeks(iso: string, weeks: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------ ATIVIDADE RECENTE */

export async function getActivity(professionalId: string) {
  const supabase = await createClient();

  const { data: patients } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('professional_id', professionalId);

  const nameById = new Map((patients ?? []).map((p) => [p.id, p.full_name]));
  const ids = [...nameById.keys()];
  if (ids.length === 0) return [];

  const [{ data: checkins }, { data: reviews }, { data: sessions }] = await Promise.all([
    supabase
      .from('checkins')
      .select('patient_id, weight_kg, created_at')
      .in('patient_id', ids)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('ai_reviews')
      .select('patient_id, summary, urgency, created_at')
      .eq('professional_id', professionalId)
      .eq('status', 'pendente')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('workout_sessions')
      .select('patient_id, finished_at, duration_seconds')
      .in('patient_id', ids)
      .not('finished_at', 'is', null)
      .order('finished_at', { ascending: false })
      .limit(5),
  ]);

  const feed = [
    ...(checkins ?? []).map((c) => ({
      who: nameById.get(c.patient_id) ?? 'Paciente',
      text: `Enviou o check-in semanal${c.weight_kg ? ` · ${c.weight_kg} kg` : ''}.`,
      at: c.created_at,
      tone: 'success' as Tone,
    })),
    ...(reviews ?? []).map((r) => ({
      who: nameById.get(r.patient_id) ?? 'Paciente',
      text: r.summary,
      at: r.created_at,
      tone: (r.urgency === 'alta' ? 'danger' : 'brand') as Tone,
    })),
    ...(sessions ?? []).map((s) => ({
      who: nameById.get(s.patient_id) ?? 'Paciente',
      text: `Concluiu um treino${
        s.duration_seconds ? ` em ${Math.round(s.duration_seconds / 60)} min` : ''
      }.`,
      at: s.finished_at!,
      tone: 'brand' as Tone,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 6);

  return feed.map((f) => ({ ...f, when: relativeTime(f.at) }));
}

/* ---------------------------------------------------------- REVISÃO DA IA */

export async function getReviewQueue(professionalId: string): Promise<ReviewView[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('ai_reviews')
    .select(
      'id, patient_id, module, urgency, status, confidence, trigger_text, summary, rationale, action, sources, before_state, after_state, created_at, profiles!ai_reviews_patient_id_fkey(full_name)',
    )
    .eq('professional_id', professionalId)
    .eq('status', 'pendente')
    .order('urgency')
    .order('created_at', { ascending: true });

  return (data ?? []).map(mapReview);
}

export async function getReview(
  id: string,
  professionalId: string,
): Promise<ReviewView | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('ai_reviews')
    .select(
      'id, patient_id, module, urgency, status, confidence, trigger_text, summary, rationale, action, sources, before_state, after_state, created_at, profiles!ai_reviews_patient_id_fkey(full_name)',
    )
    .eq('id', id)
    .eq('professional_id', professionalId)
    .maybeSingle();

  return data ? mapReview(data) : null;
}

type ReviewRowWithPatient = {
  id: string;
  patient_id: string;
  module: ReviewModule;
  urgency: ReviewUrgency;
  status: ReviewStatus;
  confidence: number;
  trigger_text: string;
  summary: string;
  rationale: string;
  action: string;
  sources: string[];
  before_state: Json;
  after_state: Json;
  created_at: string;
  profiles: { full_name: string } | { full_name: string }[] | null;
};

function mapReview(row: ReviewRowWithPatient): ReviewView {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

  return {
    id: row.id,
    patientId: row.patient_id,
    patient: profile?.full_name ?? 'Paciente',
    module: MODULE_LABEL[row.module],
    urgency: row.urgency,
    status: row.status,
    confidence: row.confidence,
    trigger: row.trigger_text,
    summary: row.summary,
    rationale: row.rationale,
    action: row.action,
    sources: row.sources ?? [],
    age: relativeTime(row.created_at),
    before: toDiffSide(row.before_state, 'Protocolo atual'),
    after: toDiffSide(row.after_state, 'Proposta da IA'),
  };
}

/* ------------------------------------------------------------ PROTOCOLOS */

export async function getProtocols(professionalId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('protocols')
    .select('id, title, kind, ai_enabled, uses, body, created_at')
    .eq('professional_id', professionalId)
    .order('created_at', { ascending: false });

  return (data ?? []).map((p) => {
    // `body` é jsonb livre; normaliza com defaults em vez de confiar no formato.
    const body = (p.body ?? {}) as Record<string, unknown>;

    return {
      id: p.id,
      title: p.title,
      kind: p.kind as ProtocolKind,
      aiEnabled: p.ai_enabled,
      uses: p.uses,
      description: typeof body.description === 'string' ? body.description : '',
      items: Array.isArray(body.items) ? body.items.map(String) : [],
    };
  });
}

/* ----------------------------------------------------------- FATURAMENTO */

export async function getFinance(professionalId: string) {
  const supabase = await createClient();

  const { data: patients } = await supabase
    .from('profiles')
    .select('id, full_name, plan')
    .eq('professional_id', professionalId)
    .eq('role', 'paciente');

  const ids = (patients ?? []).map((p) => p.id);
  const nameById = new Map((patients ?? []).map((p) => [p.id, p.full_name]));

  if (ids.length === 0) {
    return {
      kpis: { mrrCents: 0, activeSubs: 0, avgTicketCents: 0, failureRate: 0 },
      planMix: [],
      revenueSeries: [],
      transactions: [],
    };
  }

  const [{ data: subs }, { data: txs }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('patient_id, tier, amount_cents, is_active')
      .in('patient_id', ids),
    supabase
      .from('transactions')
      .select('patient_id, amount_cents, status, occurred_at')
      .in('patient_id', ids)
      .order('occurred_at', { ascending: false })
      .limit(200),
  ]);

  const active = (subs ?? []).filter((s) => s.is_active);
  const mrrCents = active.reduce((sum, s) => sum + s.amount_cents, 0);

  const mixCounts = new Map<PlanTier, number>();
  for (const s of active) mixCounts.set(s.tier, (mixCounts.get(s.tier) ?? 0) + 1);

  const planMix = (['completo', 'nutricao', 'treino'] as PlanTier[])
    .map((tier) => ({
      name: PLAN_LABEL[tier],
      value: mixCounts.get(tier) ?? 0,
      percent: active.length ? Math.round(((mixCounts.get(tier) ?? 0) / active.length) * 100) : 0,
    }))
    .filter((m) => m.value > 0);

  // Receita paga dos últimos 8 meses.
  const months: { month: string; value: number }[] = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    const start = d.getTime();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();

    const cents = (txs ?? [])
      .filter((t) => {
        const at = new Date(t.occurred_at).getTime();
        return t.status === 'pago' && at >= start && at < end;
      })
      .reduce((sum, t) => sum + t.amount_cents, 0);

    months.push({
      month: label.charAt(0).toUpperCase() + label.slice(1),
      value: Number((cents / 100000).toFixed(1)), // em R$ mil
    });
  }

  const recent = (txs ?? []).slice(0, 60);
  const failed = recent.filter((t) => t.status === 'falhou').length;

  return {
    kpis: {
      mrrCents,
      activeSubs: active.length,
      avgTicketCents: active.length ? Math.round(mrrCents / active.length) : 0,
      failureRate: recent.length ? Number(((failed / recent.length) * 100).toFixed(1)) : 0,
    },
    planMix,
    revenueSeries: months,
    transactions: (txs ?? []).slice(0, 8).map((t) => ({
      name: nameById.get(t.patient_id) ?? 'Paciente',
      amountCents: t.amount_cents,
      status: PAYMENT_LABEL[t.status],
      tone: PAYMENT_TONE[t.status],
      date: relativeTime(t.occurred_at),
    })),
  };
}

/* ------------------------------------------------- DETALHE DO PACIENTE --- */

export async function getPatientDetail(patientId: string, professionalId: string) {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, plan, goal, height_cm, created_at, avatar_url')
    .eq('id', patientId)
    .eq('professional_id', professionalId)
    .maybeSingle();

  if (!profile) return null;

  const [{ data: metrics }, { data: adherence }, { data: exam }, { data: checkin }, { data: plan }] =
    await Promise.all([
      supabase
        .from('body_metrics')
        .select('measured_on, weight_kg')
        .eq('patient_id', patientId)
        .order('measured_on')
        .limit(24),
      supabase.rpc('weekly_adherence', { target_patient: patientId, weeks: 8 }),
      supabase
        .from('exams')
        .select('collected_on, lab, exam_markers(name, value_text, ref_range, status, position)')
        .eq('patient_id', patientId)
        .order('collected_on', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('checkins')
        .select('created_at, adherence')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('nutrition_plans')
        .select('title, kcal_target, protein_g, carb_g, fat_g')
        .eq('patient_id', patientId)
        .eq('is_active', true)
        .maybeSingle(),
    ]);

  const weights = (metrics ?? []).filter((m) => m.weight_kg !== null);

  return {
    id: profile.id,
    name: profile.full_name,
    avatarUrl: profile.avatar_url,
    email: profile.email,
    plan: profile.plan ? PLAN_LABEL[profile.plan] : 'Sem plano',
    goal: profile.goal ?? '—',
    weight: weights.length ? Number(weights[weights.length - 1].weight_kg) : null,
    lastCheckin: checkin ? relativeTime(checkin.created_at) : 'nunca',
    adherence: checkin?.adherence ? checkin.adherence * 20 : 0,
    weightSeries: weights.map((m) => Number(m.weight_kg)),
    adherenceSeries: (adherence ?? []).map((a) => a.adherence),
    nutritionPlan: plan,
    markers: exam
      ? (
          (exam.exam_markers ?? []) as {
            name: string;
            value_text: string;
            ref_range: string | null;
            status: MarkerStatus;
            position: number;
          }[]
        )
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((m) => ({
            name: m.name,
            value: m.value_text,
            ref: m.ref_range ?? '—',
            status: m.status,
          }))
      : [],
  };
}

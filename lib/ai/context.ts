import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { computeWaterGoal, idadeEmAnos } from '@/lib/hydration';
import { todayISO } from '@/lib/utils';
import type { AiDetailLevel, AiPriority, Json } from '@/lib/supabase/types';

/**
 * Contexto estruturado do cliente.
 *
 * Esta é a camada que decide **o que a IA vê**. Existe para que nenhuma
 * chamada mande o banco inteiro para um provedor externo: cada seção só é
 * montada quando o escopo pedir, e cada seção tem um teto de linhas.
 *
 * Duas regras que valem para tudo aqui:
 *
 *   1. Nada de identificador. Nome, e-mail, telefone e UUID ficam de fora —
 *      o modelo não precisa deles para avaliar um hemograma, e mandá-los
 *      seria expor dado pessoal sem necessidade.
 *   2. Nada de seção vazia. Se o paciente não tem exame, a seção "exames"
 *      simplesmente não existe no prompt, em vez de ir como "[]" — o que
 *      convida o modelo a inventar.
 */

export type ContextScope =
  | 'saude'
  | 'exames'
  | 'treino'
  | 'nutricao'
  | 'evolucao'
  | 'checkins';

export const ALL_SCOPES: ContextScope[] = [
  'saude',
  'exames',
  'treino',
  'nutricao',
  'evolucao',
  'checkins',
];

export type AnalysisProtocol = {
  objective: string;
  priority: AiPriority;
  scopes: ContextScope[];
  detailLevel: AiDetailLevel;
  notes: string | null;
  professionalName: string | null;
};

export type PatientContext = {
  /** Texto pronto para o prompt. */
  text: string;
  /** Seções efetivamente incluídas — usado para avisar o usuário. */
  sections: string[];
  /** Sinaliza contexto pobre demais para uma análise honesta. */
  sparse: boolean;
  protocol: AnalysisProtocol | null;
};

/* --------------------------------------------------------------- LIMITES */

/** Tetos por seção. Histórico longo demais degrada a resposta e o custo. */
const LIMITS = {
  metrics: 12,
  checkins: 8,
  exams: 3,
  markersPerExam: 25,
  sessions: 12,
  meals: 12,
  documents: 5,
} as const;

const OBJETIVO_PADRAO = 'não informado';

const round1 = (n: number | null | undefined) =>
  n === null || n === undefined ? null : Math.round(Number(n) * 10) / 10;

/* --------------------------------------------------------------- MONTAGEM */

type Section = { title: string; lines: string[] };

function render(sections: Section[]): string {
  return sections
    .filter((s) => s.lines.length > 0)
    .map((s) => `## ${s.title}\n${s.lines.join('\n')}`)
    .join('\n\n');
}

/**
 * Monta o contexto do paciente respeitando o protocolo do profissional.
 *
 * `scopes` restringe o que é lido do banco — a consulta nem chega a ser feita
 * para uma área fora do escopo.
 */
export async function buildPatientContext(
  patientId: string,
  options: { scopes?: ContextScope[]; includeProtocol?: boolean } = {},
): Promise<PatientContext> {
  const supabase = await createClient();

  // O protocolo do profissional pode redefinir o escopo pedido.
  const { data: protocolRow } = await supabase
    .from('ai_protocols')
    .select('objective, priority, scopes, detail_level, notes, professional_id')
    .eq('patient_id', patientId)
    .maybeSingle();

  const protocolScopes = (protocolRow?.scopes ?? []).filter((s): s is ContextScope =>
    ALL_SCOPES.includes(s as ContextScope),
  );

  const requested = options.scopes ?? ALL_SCOPES;
  // Quando existe protocolo, ele é o teto: a IA não olha o que o
  // profissional excluiu, mesmo que a tela peça.
  const scopes =
    protocolRow && protocolScopes.length > 0
      ? requested.filter((s) => protocolScopes.includes(s))
      : requested;

  const has = (s: ContextScope) => scopes.includes(s);

  // Literal único: concatenar quebraria a inferência de tipo do supabase-js.
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'goal, height_cm, birth_date, sex, plan, activity_level, training_level, training_days, routine, food_preferences, food_restrictions, health_notes, kcal_goal, water_goal_override_ml, professional_id, created_at',
    )
    .eq('id', patientId)
    .single();

  const sections: Section[] = [];

  /* ------------------------------------------------------------ pessoal */

  const { data: weightRow } = await supabase
    .from('body_metrics')
    .select('weight_kg, body_fat_pct, lean_mass_kg, waist_cm, measured_on')
    .eq('patient_id', patientId)
    .order('measured_on', { ascending: false })
    .limit(1)
    .maybeSingle();

  const idade = idadeEmAnos(profile?.birth_date ?? null);
  const peso = round1(weightRow?.weight_kg);

  const pessoal: string[] = [];
  if (idade !== null) pessoal.push(`- Idade: ${idade} anos`);
  if (profile?.sex) pessoal.push(`- Sexo: ${profile.sex}`);
  if (profile?.height_cm) pessoal.push(`- Altura: ${profile.height_cm} cm`);
  if (peso !== null) {
    pessoal.push(`- Peso atual: ${peso} kg (medido em ${weightRow?.measured_on})`);
  }
  if (profile?.height_cm && peso !== null) {
    const imc = peso / Math.pow(profile.height_cm / 100, 2);
    pessoal.push(`- IMC: ${imc.toFixed(1)}`);
  }
  sections.push({ title: 'Dados pessoais', lines: pessoal });

  /* ---------------------------------------------------------- objetivos */

  const objetivos = [
    `- Objetivo declarado: ${profile?.goal?.trim() || OBJETIVO_PADRAO}`,
  ];
  if (profile?.training_level) objetivos.push(`- Nível de treino: ${profile.training_level}`);
  if (profile?.activity_level) objetivos.push(`- Nível de atividade: ${profile.activity_level}`);
  if (profile?.training_days !== null && profile?.training_days !== undefined) {
    objetivos.push(`- Disponibilidade: ${profile.training_days} dias de treino por semana`);
  }
  if (profile?.routine?.trim()) objetivos.push(`- Rotina: ${profile.routine.trim()}`);
  if (profile?.plan) objetivos.push(`- Plano contratado: ${profile.plan}`);
  sections.push({ title: 'Objetivos e rotina', lines: objetivos });

  /* -------------------------------------------------------------- saúde */

  if (has('saude')) {
    const saude: string[] = [];
    if (profile?.health_notes?.trim()) {
      saude.push(`- Histórico informado: ${profile.health_notes.trim()}`);
    }
    if (profile?.food_restrictions?.length) {
      saude.push(`- Restrições: ${profile.food_restrictions.join(', ')}`);
    }
    if (profile?.food_preferences?.length) {
      saude.push(`- Preferências alimentares: ${profile.food_preferences.join(', ')}`);
    }

    const goal = computeWaterGoal({
      weightKg: peso,
      heightCm: profile?.height_cm ?? null,
      birthDate: profile?.birth_date ?? null,
      activityLevel: profile?.activity_level ?? null,
      trainingDays: profile?.training_days ?? null,
      overrideMl: profile?.water_goal_override_ml ?? null,
    });

    const { data: hydration } = await supabase
      .from('hydration_logs')
      .select('amount_ml')
      .eq('patient_id', patientId)
      .eq('logged_on', todayISO());

    const totalHoje = (hydration ?? []).reduce((sum, h) => sum + h.amount_ml, 0);
    saude.push(
      `- Hidratação hoje: ${totalHoje} ml de uma meta de ${goal.goalMl} ml`,
    );

    sections.push({ title: 'Saúde', lines: saude });
  }

  /* ------------------------------------------------------------- exames */

  if (has('exames')) {
    const [{ data: exams }, { data: documents }] = await Promise.all([
      supabase
        .from('exams')
        .select(
          'collected_on, lab, exam_markers(name, value_text, unit, ref_range, status, delta_text, position)',
        )
        .eq('patient_id', patientId)
        .order('collected_on', { ascending: false })
        .limit(LIMITS.exams),
      supabase
        .from('health_documents')
        .select('collected_on, lab, summary, markers, highlights, status')
        .eq('patient_id', patientId)
        .eq('status', 'analisado')
        .order('created_at', { ascending: false })
        .limit(LIMITS.documents),
    ]);

    const linhas: string[] = [];

    for (const exam of exams ?? []) {
      const markers = (
        (exam.exam_markers ?? []) as {
          name: string;
          value_text: string;
          unit: string | null;
          ref_range: string | null;
          status: string;
          delta_text: string | null;
          position: number;
        }[]
      )
        .slice()
        .sort((a, b) => a.position - b.position)
        .slice(0, LIMITS.markersPerExam);

      linhas.push(`- Coleta ${exam.collected_on}${exam.lab ? ` (${exam.lab})` : ''}:`);
      for (const m of markers) {
        const ref = m.ref_range ? ` | ref ${m.ref_range}` : '';
        const delta = m.delta_text ? ` | variação ${m.delta_text}` : '';
        linhas.push(
          `  · ${m.name}: ${m.value_text}${m.unit ? ` ${m.unit}` : ''}${ref} | ${m.status}${delta}`,
        );
      }
    }

    for (const doc of documents ?? []) {
      const markers = Array.isArray(doc.markers)
        ? (doc.markers as Json[]).slice(0, LIMITS.markersPerExam)
        : [];
      linhas.push(
        `- Documento enviado${doc.collected_on ? ` (coleta ${doc.collected_on})` : ''}: ${
          doc.summary ?? 'sem resumo'
        }`,
      );
      for (const m of markers as Record<string, unknown>[]) {
        if (!m || typeof m !== 'object') continue;
        linhas.push(
          `  · ${String(m.name ?? '?')}: ${String(m.value ?? '?')}${
            m.unit ? ` ${String(m.unit)}` : ''
          } | ${String(m.status ?? 'indeterminado')}`,
        );
      }
    }

    sections.push({ title: 'Exames', lines: linhas });
  }

  /* ------------------------------------------------------------- treino */

  if (has('treino')) {
    const [{ data: plan }, { data: sessions }] = await Promise.all([
      supabase
        .from('workout_plans')
        .select(
          'title, split, week_number, total_weeks, workouts(letter, title, focus, est_minutes, weekday, position, exercises(name, muscle, target_sets, target_reps, target_load, position))',
        )
        .eq('patient_id', patientId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('workout_sessions')
        .select('started_at, finished_at, duration_seconds, rpe')
        .eq('patient_id', patientId)
        .order('started_at', { ascending: false })
        .limit(LIMITS.sessions),
    ]);

    const linhas: string[] = [];

    if (plan) {
      linhas.push(
        `- Plano ativo: ${plan.title}${plan.split ? ` (${plan.split})` : ''} — semana ${plan.week_number} de ${plan.total_weeks}`,
      );
      const workouts = (
        (plan.workouts ?? []) as {
          letter: string;
          title: string;
          focus: string;
          est_minutes: number;
          weekday: number | null;
          position: number;
          exercises: {
            name: string;
            muscle: string;
            target_sets: number;
            target_reps: string;
            target_load: string | null;
            position: number;
          }[];
        }[]
      )
        .slice()
        .sort((a, b) => a.position - b.position);

      for (const w of workouts) {
        const ex = (w.exercises ?? [])
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((e) => `${e.name} ${e.target_sets}x${e.target_reps}`)
          .join('; ');
        linhas.push(`  · Ficha ${w.letter} — ${w.focus} (${w.est_minutes} min): ${ex}`);
      }
    }

    const concluidas = (sessions ?? []).filter((s) => s.finished_at);
    if (sessions?.length) {
      const media =
        concluidas.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0) /
        Math.max(1, concluidas.length);

      linhas.push(
        `- Últimas ${sessions.length} sessões: ${concluidas.length} concluídas, duração média ${Math.round(media / 60)} min`,
      );
      for (const s of concluidas.slice(0, 6)) {
        linhas.push(
          `  · ${s.started_at.slice(0, 10)} — ${Math.round((s.duration_seconds ?? 0) / 60)} min${
            s.rpe ? `, PSE ${s.rpe}/10` : ''
          }`,
        );
      }
    }

    sections.push({ title: 'Treino', lines: linhas });
  }

  /* ----------------------------------------------------------- nutrição */

  if (has('nutricao')) {
    const { data: plan } = await supabase
      .from('nutrition_plans')
      .select(
        'title, kcal_target, protein_g, carb_g, fat_g, meals(label, serve_at, title, kcal, protein_g, carb_g, fat_g, position, meal_items(description, position))',
      )
      .eq('patient_id', patientId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const linhas: string[] = [];

    if (plan) {
      linhas.push(
        `- Plano ativo: ${plan.title} — ${plan.kcal_target} kcal (P ${plan.protein_g}g / C ${plan.carb_g}g / G ${plan.fat_g}g)`,
      );
      const meals = (
        (plan.meals ?? []) as {
          label: string;
          serve_at: string;
          title: string;
          kcal: number;
          position: number;
          meal_items: { description: string; position: number }[];
        }[]
      )
        .slice()
        .sort((a, b) => a.position - b.position)
        .slice(0, LIMITS.meals);

      for (const m of meals) {
        const itens = (m.meal_items ?? [])
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((i) => i.description)
          .join('; ');
        linhas.push(`  · ${m.label} ${m.serve_at.slice(0, 5)} — ${m.title} (${m.kcal} kcal): ${itens}`);
      }
    } else if (profile?.kcal_goal) {
      linhas.push(`- Sem plano ativo. Meta calórica no perfil: ${profile.kcal_goal} kcal`);
    }

    // Adesão real das últimas semanas — é o que separa "o plano existe" de
    // "o plano está sendo seguido".
    const { data: adherence } = await supabase.rpc('weekly_adherence', {
      target_patient: patientId,
      weeks: 6,
    });

    if (adherence?.length) {
      linhas.push(
        `- Adesão às refeições por semana: ${adherence
          .map((a) => `${a.week_start}: ${a.adherence}%`)
          .join(' | ')}`,
      );
    }

    sections.push({ title: 'Nutrição', lines: linhas });
  }

  /* ----------------------------------------------------------- check-ins */

  if (has('checkins')) {
    const { data: checkins } = await supabase
      .from('checkins')
      .select('week_start, weight_kg, sleep_hours, energy, hunger, pain, adherence, notes')
      .eq('patient_id', patientId)
      .order('week_start', { ascending: false })
      .limit(LIMITS.checkins);

    const linhas = (checkins ?? []).map(
      (c) =>
        `- Semana ${c.week_start}: peso ${round1(c.weight_kg) ?? '—'} kg, sono ${
          round1(c.sleep_hours) ?? '—'
        } h, energia ${c.energy}/5, fome ${c.hunger}/5, dor ${c.pain}/5, adesão ${
          c.adherence
        }/5${c.notes ? ` — "${c.notes.slice(0, 200)}"` : ''}`,
    );

    sections.push({ title: 'Check-ins semanais', lines: linhas });
  }

  /* ----------------------------------------------------------- evolução */

  if (has('evolucao')) {
    const { data: metrics } = await supabase
      .from('body_metrics')
      .select('measured_on, weight_kg, body_fat_pct, lean_mass_kg, waist_cm')
      .eq('patient_id', patientId)
      .order('measured_on', { ascending: false })
      .limit(LIMITS.metrics);

    const linhas = (metrics ?? [])
      .slice()
      .reverse()
      .map(
        (m) =>
          `- ${m.measured_on}: peso ${round1(m.weight_kg) ?? '—'} kg, gordura ${
            round1(m.body_fat_pct) ?? '—'
          } %, massa magra ${round1(m.lean_mass_kg) ?? '—'} kg, cintura ${
            round1(m.waist_cm) ?? '—'
          } cm`,
      );

    sections.push({ title: 'Evolução corporal', lines: linhas });
  }

  /* ------------------------------------ observações do profissional ---- */

  let protocol: AnalysisProtocol | null = null;

  if (protocolRow && options.includeProtocol !== false) {
    let professionalName: string | null = null;
    if (protocolRow.professional_id) {
      const { data: pro } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', protocolRow.professional_id)
        .maybeSingle();
      professionalName = pro?.full_name ?? null;
    }

    protocol = {
      objective: protocolRow.objective,
      priority: protocolRow.priority,
      scopes: protocolScopes,
      detailLevel: protocolRow.detail_level,
      notes: protocolRow.notes,
      professionalName,
    };

    const linhas = [
      `- Objetivo principal definido pelo profissional: ${protocol.objective}`,
      `- Prioridade: ${protocol.priority}`,
      `- Nível de detalhamento pedido: ${protocol.detailLevel}`,
      `- Áreas a analisar: ${protocolScopes.join(', ') || 'todas'}`,
    ];
    if (protocol.notes?.trim()) {
      linhas.push(`- Observações do profissional: ${protocol.notes.trim()}`);
    }

    sections.unshift({ title: 'Protocolo de análise do profissional', lines: linhas });
  }

  const included = sections.filter((s) => s.lines.length > 0).map((s) => s.title);

  /*
    "Contexto pobre" = só dá para falar de dados cadastrais.
    Vale avisar: uma análise construída sobre nada vira texto genérico, e o
    usuário merece saber disso antes de gastar a cota do mês.
  */
  const sparse = included.length <= 2;

  return {
    text: render(sections),
    sections: included,
    sparse,
    protocol,
  };
}

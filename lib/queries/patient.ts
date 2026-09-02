import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { shortTime, todayISO, weekStartISO } from '@/lib/utils';
import { computeWaterGoal, explainWaterGoal } from '@/lib/hydration';
import type { MarkerStatus, MealSlot } from '@/lib/supabase/types';

/* ------------------------------------------------------------ VIEW MODELS */

export type MealView = {
  id: string;
  slot: MealSlot;
  label: string;
  time: string;
  title: string;
  kcal: number;
  macros: { p: number; c: number; g: number };
  items: string[];
  done: boolean;
  swappable: boolean;
};

export type NutritionView = {
  planId: string | null;
  title: string;
  target: { kcal: number; protein: number; carb: number; fat: number };
  consumed: { kcal: number; protein: number; carb: number; fat: number };
  meals: MealView[];
};

export type ExerciseView = {
  id: string;
  name: string;
  muscle: string;
  sets: number;
  reps: string;
  load: string;
  rest: string;
  note: string | null;
};

export type WorkoutView = {
  id: string;
  letter: string;
  title: string;
  focus: string;
  minutes: number;
  exercises: ExerciseView[];
};

export type WeekDayView = {
  day: string;
  letter: string;
  focus: string;
  state: 'done' | 'today' | 'next' | 'rest';
};

export type HydrationView = {
  goalMl: number;
  totalMl: number;
  /** Percentual da meta já atingido, entre 0 e 100. */
  percent: number;
  /** `true` quando a meta veio de prescrição, não do cálculo. */
  manualGoal: boolean;
  /** Frase que explica de onde saiu o número. */
  explanation: string;
  /** Peso que serviu de base — `null` quando ainda não há registro. */
  basisWeightKg: number | null;
  /** Dia a que este total pertence, no fuso do paciente. */
  day: string;
  entries: { id: string; amountMl: number; at: string }[];
};

export type MarkerView = {
  name: string;
  value: string;
  ref: string;
  status: MarkerStatus;
  delta: string;
};

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

/* ------------------------------------------------------------- HIDRATAÇÃO */

/**
 * Hidratação do dia, com a meta **calculada** — nunca um número fixo.
 *
 * A meta sai de `computeWaterGoal` a partir do peso mais recente. Como o
 * cálculo acontece na leitura, registrar um peso novo no check-in muda a meta
 * na próxima renderização, sem nenhuma rotina de sincronização no meio.
 *
 * O dia é resolvido no fuso do paciente: às 22h em São Paulo, UTC já virou, e
 * o copo d'água cairia no dia seguinte. É também o que faz o progresso
 * reiniciar na hora certa.
 */
export async function getHydration(
  patientId: string,
  profile: {
    heightCm: number | null;
    birthDate: string | null;
    activityLevel: string | null;
    trainingDays: number | null;
    overrideMl: number | null;
    timezone?: string;
  },
): Promise<HydrationView> {
  const supabase = await createClient();
  const day = todayISO(profile.timezone);

  const [{ data }, { data: weightRow }] = await Promise.all([
    supabase
      .from('hydration_logs')
      .select('id, amount_ml, logged_at')
      .eq('patient_id', patientId)
      .eq('logged_on', day)
      .order('logged_at', { ascending: false }),
    supabase
      .from('body_metrics')
      .select('weight_kg')
      .eq('patient_id', patientId)
      .not('weight_kg', 'is', null)
      .order('measured_on', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const entries = (data ?? []).map((r) => ({
    id: r.id,
    amountMl: r.amount_ml,
    at: r.logged_at,
  }));

  const weightKg = weightRow?.weight_kg ?? null;

  const goal = computeWaterGoal({
    weightKg,
    heightCm: profile.heightCm,
    birthDate: profile.birthDate,
    activityLevel: profile.activityLevel,
    trainingDays: profile.trainingDays,
    overrideMl: profile.overrideMl,
  });

  const totalMl = entries.reduce((sum, e) => sum + e.amountMl, 0);

  return {
    goalMl: goal.goalMl,
    totalMl,
    percent: goal.goalMl > 0 ? Math.min(100, (totalMl / goal.goalMl) * 100) : 0,
    manualGoal: goal.manual,
    explanation: explainWaterGoal(goal),
    basisWeightKg: weightKg,
    day,
    entries,
  };
}

/* --------------------------------------------------------------- NUTRIÇÃO */

export async function getNutrition(patientId: string): Promise<NutritionView> {
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from('nutrition_plans')
    .select('id, title, kcal_target, protein_g, carb_g, fat_g')
    .eq('patient_id', patientId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const empty: NutritionView = {
    planId: null,
    title: 'Nenhum plano ativo',
    target: { kcal: 0, protein: 0, carb: 0, fat: 0 },
    consumed: { kcal: 0, protein: 0, carb: 0, fat: 0 },
    meals: [],
  };

  if (!plan) return empty;

  // Refeições + itens em uma consulta só (join aninhado do PostgREST).
  const { data: meals } = await supabase
    .from('meals')
    .select(
      'id, slot, label, serve_at, title, kcal, protein_g, carb_g, fat_g, swappable, position, meal_items(description, position)',
    )
    .eq('plan_id', plan.id)
    .order('position');

  const { data: logs } = await supabase
    .from('meal_logs')
    .select('meal_id')
    .eq('patient_id', patientId)
    .eq('logged_on', todayISO());

  const doneIds = new Set((logs ?? []).map((l) => l.meal_id));

  const mealViews: MealView[] = (meals ?? []).map((m) => {
    const items = ((m.meal_items ?? []) as { description: string; position: number }[])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((i) => i.description);

    return {
      id: m.id,
      slot: m.slot,
      label: m.label,
      time: shortTime(m.serve_at),
      title: m.title,
      kcal: m.kcal,
      macros: { p: m.protein_g, c: m.carb_g, g: m.fat_g },
      items,
      done: doneIds.has(m.id),
      swappable: m.swappable,
    };
  });

  const consumed = mealViews
    .filter((m) => m.done)
    .reduce(
      (acc, m) => ({
        kcal: acc.kcal + m.kcal,
        protein: acc.protein + m.macros.p,
        carb: acc.carb + m.macros.c,
        fat: acc.fat + m.macros.g,
      }),
      { kcal: 0, protein: 0, carb: 0, fat: 0 },
    );

  return {
    planId: plan.id,
    title: plan.title,
    target: {
      kcal: plan.kcal_target,
      protein: plan.protein_g,
      carb: plan.carb_g,
      fat: plan.fat_g,
    },
    consumed,
    meals: mealViews,
  };
}

/* ----------------------------------------------------------------- TREINO */

export async function getTraining(patientId: string) {
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from('workout_plans')
    .select('id, title, split, week_number, total_weeks')
    .eq('patient_id', patientId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!plan) {
    return { plan: null, today: null as WorkoutView | null, week: [] as WeekDayView[] };
  }

  const { data: workouts } = await supabase
    .from('workouts')
    .select(
      'id, letter, title, focus, est_minutes, weekday, position, exercises(id, name, muscle, target_sets, target_reps, target_load, rest_text, note, position)',
    )
    .eq('plan_id', plan.id)
    .order('position');

  const list = workouts ?? [];

  // 1 = segunda … 7 = domingo, alinhado com a coluna `weekday`.
  const todayIdx = ((new Date(`${todayISO()}T12:00:00`).getDay() + 6) % 7) + 1;

  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('workout_id, started_at')
    .eq('patient_id', patientId)
    .gte('started_at', `${weekStartISO()}T00:00:00`)
    .not('finished_at', 'is', null);

  const doneWorkoutIds = new Set((sessions ?? []).map((s) => s.workout_id));

  const week: WeekDayView[] = DAY_LABELS.map((day, i) => {
    const weekday = i + 1;
    const w = list.find((x) => x.weekday === weekday);

    if (!w) return { day, letter: '—', focus: 'Descanso', state: 'rest' as const };

    const state: WeekDayView['state'] = doneWorkoutIds.has(w.id)
      ? 'done'
      : weekday === todayIdx
        ? 'today'
        : weekday < todayIdx
          ? 'rest'
          : 'next';

    return { day, letter: w.letter, focus: w.focus, state };
  });

  const todayWorkout = list.find((w) => w.weekday === todayIdx) ?? list[0];

  const today: WorkoutView | null = todayWorkout
    ? {
        id: todayWorkout.id,
        letter: todayWorkout.letter,
        title: todayWorkout.title,
        focus: todayWorkout.focus,
        minutes: todayWorkout.est_minutes,
        exercises: (
          (todayWorkout.exercises ?? []) as {
            id: string;
            name: string;
            muscle: string;
            target_sets: number;
            target_reps: string;
            target_load: string | null;
            rest_text: string | null;
            note: string | null;
            position: number;
          }[]
        )
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((e) => ({
            id: e.id,
            name: e.name,
            muscle: e.muscle,
            sets: e.target_sets,
            reps: e.target_reps,
            load: e.target_load ?? '—',
            rest: e.rest_text ?? '—',
            note: e.note,
          })),
      }
    : null;

  return { plan, today, week };
}

/* -------------------------------------------------------------- PROGRESSO */

export async function getProgress(patientId: string) {
  const supabase = await createClient();

  const [{ data: metrics }, { data: adherence }, { data: exam }] = await Promise.all([
    supabase
      .from('body_metrics')
      .select('measured_on, weight_kg, body_fat_pct, lean_mass_kg, waist_cm')
      .eq('patient_id', patientId)
      .order('measured_on', { ascending: true })
      .limit(24),
    supabase.rpc('weekly_adherence', { target_patient: patientId, weeks: 8 }),
    supabase
      .from('exams')
      .select(
        'id, collected_on, lab, exam_markers(name, value_text, ref_range, status, delta_text, position)',
      )
      .eq('patient_id', patientId)
      .order('collected_on', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const rows = metrics ?? [];
  const weights = rows.filter((r) => r.weight_kg !== null);

  const markers: MarkerView[] = exam
    ? (
        (exam.exam_markers ?? []) as {
          name: string;
          value_text: string;
          ref_range: string | null;
          status: MarkerStatus;
          delta_text: string | null;
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
          delta: m.delta_text ?? '0',
        }))
    : [];

  const latest = rows[rows.length - 1];
  const first = rows[0];

  const delta = (a?: number | null, b?: number | null, unit = '', digits = 1) => {
    if (a === null || a === undefined || b === null || b === undefined) return '—';
    const d = a - b;
    return `${d > 0 ? '+' : ''}${d.toFixed(digits).replace('.', ',')} ${unit}`.trim();
  };

  const measurements = [
    {
      label: 'Peso',
      value: latest?.weight_kg ? `${latest.weight_kg.toFixed(1).replace('.', ',')} kg` : '—',
      delta: delta(latest?.weight_kg, first?.weight_kg, 'kg'),
      good: (latest?.weight_kg ?? 0) <= (first?.weight_kg ?? 0),
    },
    {
      label: 'Gordura',
      value: latest?.body_fat_pct ? `${latest.body_fat_pct.toFixed(1).replace('.', ',')} %` : '—',
      delta: delta(latest?.body_fat_pct, first?.body_fat_pct, 'pp'),
      good: (latest?.body_fat_pct ?? 0) <= (first?.body_fat_pct ?? 0),
    },
    {
      label: 'Massa magra',
      value: latest?.lean_mass_kg ? `${latest.lean_mass_kg.toFixed(1).replace('.', ',')} kg` : '—',
      delta: delta(latest?.lean_mass_kg, first?.lean_mass_kg, 'kg'),
      good: (latest?.lean_mass_kg ?? 0) >= (first?.lean_mass_kg ?? 0),
    },
    {
      label: 'Cintura',
      value: latest?.waist_cm ? `${latest.waist_cm.toFixed(0)} cm` : '—',
      delta: delta(latest?.waist_cm, first?.waist_cm, 'cm', 0),
      good: (latest?.waist_cm ?? 0) <= (first?.waist_cm ?? 0),
    },
  ];

  return {
    weightSeries: weights.map((r) => Number(r.weight_kg)),
    weightLabels: weights.map((_, i) => `S${i + 1}`),
    adherenceSeries: (adherence ?? []).map((a) => a.adherence),
    adherenceLabels: (adherence ?? []).map((_, i) => `S${i + 1}`),
    measurements,
    markers,
    exam: exam ? { collectedOn: exam.collected_on, lab: exam.lab } : null,
  };
}

/* --------------------------------------------------------------- CHECK-IN */

export async function getLastCheckin(patientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('checkins')
    .select('*')
    .eq('patient_id', patientId)
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

export async function hasCheckinThisWeek(patientId: string, timezone?: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from('checkins')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', patientId)
    .eq('week_start', weekStartISO(timezone));

  return (count ?? 0) > 0;
}

/**
 * Estado do check-in semanal.
 *
 * O check-in é obrigatório uma vez por semana. Em vez de espalhar essa regra
 * pelas telas, ela vira um objeto: pendente ou não, quando foi o último e
 * quando abre o próximo.
 */
export type CheckinStatus = {
  pending: boolean;
  weekStart: string;
  /** Quando o último check-in foi enviado. */
  lastAt: string | null;
  /** Segunda-feira em que o próximo check-in abre. */
  nextOpensOn: string;
};

export async function getCheckinStatus(
  patientId: string,
  timezone?: string,
): Promise<CheckinStatus> {
  const supabase = await createClient();
  const weekStart = weekStartISO(timezone);

  const [{ data: current }, { data: last }] = await Promise.all([
    supabase
      .from('checkins')
      .select('id')
      .eq('patient_id', patientId)
      .eq('week_start', weekStart)
      .maybeSingle(),
    supabase
      .from('checkins')
      .select('created_at')
      .eq('patient_id', patientId)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const next = new Date(`${weekStart}T12:00:00`);
  next.setDate(next.getDate() + 7);

  return {
    pending: !current,
    weekStart,
    lastAt: last?.created_at ?? null,
    nextOpensOn: next.toISOString().slice(0, 10),
  };
}

/* ------------------------------------------------------- PARECER DA IA ---- */

/** Última decisão clínica visível ao paciente. */
export async function getLatestDecision(patientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('ai_reviews')
    .select('summary, action, status, confidence, decided_at, module')
    .eq('patient_id', patientId)
    .neq('status', 'pendente')
    .order('decided_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

/* ------------------------------------------------------------- SEQUÊNCIA -- */

/** Dias seguidos com pelo menos uma refeição registrada. */
export async function getStreak(patientId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('meal_logs')
    .select('logged_on')
    .eq('patient_id', patientId)
    .order('logged_on', { ascending: false })
    .limit(120);

  const days = [...new Set((data ?? []).map((r) => r.logged_on))];
  if (days.length === 0) return 0;

  let streak = 0;
  const cursor = new Date(`${todayISO()}T12:00:00`);

  // Se hoje ainda não houve registro, a sequência conta a partir de ontem.
  if (days[0] !== todayISO()) cursor.setDate(cursor.getDate() - 1);

  for (const day of days) {
    if (day === cursor.toISOString().slice(0, 10)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }

  return streak;
}

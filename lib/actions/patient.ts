'use server';

import { revalidatePath } from 'next/cache';
import { createClient, requirePatient } from '@/lib/supabase/server';
import { todayISO, weekStartISO } from '@/lib/utils';
// Constantes e tipos moram fora: um arquivo 'use server' só pode exportar
// funções assíncronas.
import { MAX_INTAKE_ML, type ActionResult } from '@/lib/types';

/* ------------------------------------------------------------ HIDRATAÇÃO */

/**
 * Registra um volume exato de água, em ml, informado pelo paciente.
 * Não há incremento fixo: o valor vem do formulário.
 */
export async function logHydration(amountMl: number): Promise<ActionResult> {
  const user = await requirePatient();

  if (!Number.isFinite(amountMl)) {
    return { ok: false, error: 'Informe um valor em ml.' };
  }

  const ml = Math.round(amountMl);
  if (ml <= 0) return { ok: false, error: 'O volume precisa ser maior que zero.' };
  if (ml > MAX_INTAKE_ML) {
    return { ok: false, error: `Registre no máximo ${MAX_INTAKE_ML} ml por vez.` };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('hydration_logs').insert({
    patient_id: user.id,
    amount_ml: ml,
    // O dia vem do fuso do paciente: às 22h em São Paulo o UTC já virou, e o
    // registro cairia no dia seguinte.
    logged_on: todayISO(user.timezone),
  });

  if (error) return { ok: false, error: 'Não foi possível registrar agora.' };

  revalidatePath('/inicio');
  return { ok: true };
}

/** Desfaz um registro de hidratação (o paciente errou o volume). */
export async function removeHydration(id: string): Promise<ActionResult> {
  const user = await requirePatient();
  const supabase = await createClient();

  const { error } = await supabase
    .from('hydration_logs')
    .delete()
    .eq('id', id)
    .eq('patient_id', user.id);

  if (error) return { ok: false, error: 'Não foi possível remover.' };

  revalidatePath('/inicio');
  return { ok: true };
}

/**
 * Define uma meta fixa de água, sobrepondo o cálculo automático.
 *
 * Grava em `water_goal_override_ml`, não em `water_goal_ml`: a meta padrão
 * continua sendo derivada do peso a cada leitura, e o override é a exceção
 * consciente. Guardar o número calculado criaria uma segunda fórmula, que
 * ficaria desatualizada no primeiro check-in com peso novo.
 */
export async function updateWaterGoal(goalMl: number): Promise<ActionResult> {
  const user = await requirePatient();

  const ml = Math.round(goalMl);
  if (ml < 500 || ml > 10000) {
    return { ok: false, error: 'A meta deve ficar entre 500 ml e 10.000 ml.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ water_goal_override_ml: ml })
    .eq('id', user.id);

  if (error) return { ok: false, error: 'Não foi possível salvar a meta.' };

  revalidatePath('/inicio');
  revalidatePath('/perfil');
  return { ok: true };
}

/** Volta a meta para o valor calculado a partir do peso. */
export async function resetWaterGoal(): Promise<ActionResult> {
  const user = await requirePatient();
  const supabase = await createClient();

  const { error } = await supabase
    .from('profiles')
    .update({ water_goal_override_ml: null })
    .eq('id', user.id);

  if (error) return { ok: false, error: 'Não foi possível restaurar o cálculo.' };

  revalidatePath('/inicio');
  revalidatePath('/perfil');
  return { ok: true };
}

/**
 * Registra o peso atual fora do check-in.
 *
 * Existe porque a meta de hidratação e o contexto da IA dependem de um peso
 * recente, e obrigar a esperar a segunda-feira do check-in para atualizá-lo
 * deixaria o número velho por até seis dias.
 */
export async function registrarPeso(weightKg: number): Promise<ActionResult> {
  const user = await requirePatient();

  if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 400) {
    return { ok: false, error: 'O peso deve ficar entre 20 e 400 kg.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('body_metrics').upsert(
    {
      patient_id: user.id,
      measured_on: todayISO(user.timezone),
      weight_kg: Math.round(weightKg * 10) / 10,
    },
    { onConflict: 'patient_id,measured_on' },
  );

  if (error) return { ok: false, error: 'Não foi possível registrar o peso.' };

  // A meta de água é derivada do peso: as duas telas mudam juntas.
  revalidatePath('/inicio');
  revalidatePath('/progresso');
  revalidatePath('/perfil');
  return { ok: true };
}

/* --------------------------------------------------------------- REFEIÇÃO */

/** Marca ou desmarca uma refeição do dia. */
export async function toggleMeal(mealId: string, done: boolean): Promise<ActionResult> {
  const user = await requirePatient();
  const supabase = await createClient();

  if (done) {
    const { error } = await supabase
      .from('meal_logs')
      .insert({ patient_id: user.id, meal_id: mealId, logged_on: todayISO() });

    // 23505 = violação de unique: já estava marcada, então o efeito desejado
    // já aconteceu e não é erro.
    if (error && error.code !== '23505') {
      return { ok: false, error: 'Não foi possível registrar a refeição.' };
    }
  } else {
    const { error } = await supabase
      .from('meal_logs')
      .delete()
      .eq('patient_id', user.id)
      .eq('meal_id', mealId)
      .eq('logged_on', todayISO());

    if (error) return { ok: false, error: 'Não foi possível desmarcar.' };
  }

  revalidatePath('/nutricao');
  revalidatePath('/inicio');
  return { ok: true };
}

/* ----------------------------------------------------------------- TREINO */

/** Abre uma sessão de treino e devolve o id para registrar as séries. */
export async function startSession(workoutId: string) {
  const user = await requirePatient();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('workout_sessions')
    .insert({ patient_id: user.id, workout_id: workoutId })
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false as const, error: 'Não foi possível iniciar o treino.' };
  }

  return { ok: true as const, sessionId: data.id };
}

export async function logSet(input: {
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  loadKg: number | null;
  reps: number | null;
  done: boolean;
}): Promise<ActionResult> {
  await requirePatient();
  const supabase = await createClient();

  const { error } = await supabase.from('set_logs').upsert(
    {
      session_id: input.sessionId,
      exercise_id: input.exerciseId,
      set_number: input.setNumber,
      load_kg: input.loadKg,
      reps: input.reps,
      done: input.done,
    },
    { onConflict: 'session_id,exercise_id,set_number' },
  );

  if (error) return { ok: false, error: 'Não foi possível salvar a série.' };
  return { ok: true };
}

export async function finishSession(
  sessionId: string,
  durationSeconds: number,
): Promise<ActionResult> {
  const user = await requirePatient();
  const supabase = await createClient();

  const { error } = await supabase
    .from('workout_sessions')
    .update({
      finished_at: new Date().toISOString(),
      duration_seconds: Math.max(0, Math.round(durationSeconds)),
    })
    .eq('id', sessionId)
    .eq('patient_id', user.id);

  if (error) return { ok: false, error: 'Não foi possível finalizar o treino.' };

  revalidatePath('/treino');
  revalidatePath('/inicio');
  return { ok: true };
}

/* --------------------------------------------------------------- CHECK-IN */

export type CheckinInput = {
  weightKg: number | null;
  sleepHours: number | null;
  energy: number;
  hunger: number;
  pain: number;
  adherence: number;
  notes: string;
};

export async function submitCheckin(input: CheckinInput): Promise<ActionResult> {
  const user = await requirePatient();
  const supabase = await createClient();

  const scale = (n: number) => n >= 1 && n <= 5;
  if (![input.energy, input.hunger, input.pain, input.adherence].every(scale)) {
    return { ok: false, error: 'Responda todas as escalas de 1 a 5.' };
  }
  if (input.weightKg !== null && (input.weightKg < 20 || input.weightKg > 400)) {
    return { ok: false, error: 'Peso fora da faixa esperada.' };
  }

  // A semana é a do paciente: um check-in feito no domingo à noite em São
  // Paulo pertence àquela semana, não à seguinte do UTC.
  const week = weekStartISO(user.timezone);

  const { error } = await supabase.from('checkins').upsert(
    {
      patient_id: user.id,
      week_start: week,
      weight_kg: input.weightKg,
      sleep_hours: input.sleepHours,
      energy: input.energy,
      hunger: input.hunger,
      pain: input.pain,
      adherence: input.adherence,
      notes: input.notes.trim() || null,
    },
    { onConflict: 'patient_id,week_start' },
  );

  if (error) return { ok: false, error: 'Não foi possível enviar o check-in.' };

  /*
    O peso do check-in alimenta o gráfico de evolução — e, por tabela, a meta
    de hidratação, que é derivada do peso mais recente. Um número só, gravado
    num lugar só.
  */
  if (input.weightKg !== null) {
    await supabase.from('body_metrics').upsert(
      {
        patient_id: user.id,
        measured_on: todayISO(user.timezone),
        weight_kg: input.weightKg,
      },
      { onConflict: 'patient_id,measured_on' },
    );
  }

  revalidatePath('/progresso');
  revalidatePath('/inicio');
  revalidatePath('/checkin');
  return { ok: true };
}

/* ----------------------------------------------------------------- PERFIL */

export async function updateProfile(input: {
  fullName: string;
  heightCm: number | null;
  goal: string | null;
}): Promise<ActionResult> {
  const user = await requirePatient();

  if (input.fullName.trim().length < 3) {
    return { ok: false, error: 'Informe seu nome completo.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: input.fullName.trim(),
      height_cm: input.heightCm,
      goal: input.goal,
    })
    .eq('id', user.id);

  if (error) return { ok: false, error: 'Não foi possível salvar o perfil.' };

  revalidatePath('/perfil', 'layout');
  return { ok: true };
}

export async function updateNotificationPrefs(prefs: {
  protocolChanges: boolean;
  workoutReminder: boolean;
  examResults: boolean;
}): Promise<ActionResult> {
  const user = await requirePatient();
  const supabase = await createClient();

  const { error } = await supabase.from('notification_prefs').upsert(
    {
      profile_id: user.id,
      protocol_changes: prefs.protocolChanges,
      workout_reminder: prefs.workoutReminder,
      exam_results: prefs.examResults,
    },
    { onConflict: 'profile_id' },
  );

  if (error) return { ok: false, error: 'Não foi possível salvar as preferências.' };

  revalidatePath('/perfil');
  return { ok: true };
}

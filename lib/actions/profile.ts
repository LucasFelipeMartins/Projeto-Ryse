'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient, requireUser, requirePatientRaw } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';
import type {
  ActivityLevel,
  ProfileRow,
  Sex,
  TrainingLevel,
} from '@/lib/supabase/types';

/**
 * Perfil, avatar e onboarding — o que vale para os dois papéis.
 *
 * O que é exclusivo do paciente (hidratação, refeição, check-in) continua em
 * `lib/actions/patient.ts`.
 */

/* ------------------------------------------------------------------ AVATAR */

const AVATAR_PREFIX = 'avatares';

/**
 * Registra no perfil o avatar que o navegador acabou de enviar ao Storage.
 *
 * O upload não passa por aqui de propósito: Server Action tem teto de corpo
 * (1 MB por padrão), e mandar a imagem pelo servidor só somaria um salto. O
 * navegador escreve direto no bucket — a política de Storage já garante que
 * ninguém grava fora da própria pasta — e esta ação apenas confirma o
 * caminho e guarda a URL.
 */
export async function salvarAvatar(storagePath: string): Promise<ActionResult> {
  const user = await requireUser();

  // O caminho tem de começar pelo id do dono. Sem esta checagem, alguém
  // poderia apontar o próprio perfil para o arquivo de outra pessoa.
  if (!storagePath.startsWith(`${user.id}/`)) {
    return { ok: false, error: 'Caminho de arquivo inválido.' };
  }

  const supabase = await createClient();

  const {
    data: { publicUrl },
  } = supabase.storage.from(AVATAR_PREFIX).getPublicUrl(storagePath);

  if (!publicUrl) return { ok: false, error: 'Não foi possível gerar o link da imagem.' };

  const anterior = user.avatarUrl;

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', user.id);

  if (error) return { ok: false, error: 'Não foi possível salvar a foto.' };

  // Limpa a imagem antiga para o bucket não virar depósito de versões.
  await removeStoredAvatar(anterior, user.id);

  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function removerAvatar(): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', user.id);

  if (error) return { ok: false, error: 'Não foi possível remover a foto.' };

  await removeStoredAvatar(user.avatarUrl, user.id);

  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Apaga o objeto anterior do bucket, se ele for mesmo deste usuário. */
async function removeStoredAvatar(url: string | null, ownerId: string) {
  if (!url) return;

  const marker = `/${AVATAR_PREFIX}/`;
  const index = url.indexOf(marker);
  if (index === -1) return;

  const path = url.slice(index + marker.length).split('?')[0];
  if (!path.startsWith(`${ownerId}/`)) return;

  const supabase = await createClient();
  await supabase.storage.from(AVATAR_PREFIX).remove([path]);
}

/* -------------------------------------------------------------- ONBOARDING */

export type OnboardingInput = {
  fullName: string;
  phone: string;
  birthDate: string | null;
  sex: Sex | null;
  heightCm: number | null;
  weightKg: number | null;
  goal: string;
  activityLevel: ActivityLevel | null;
  trainingLevel: TrainingLevel | null;
  trainingDays: number | null;
  routine: string;
  foodPreferences: string[];
  foodRestrictions: string[];
  healthNotes: string;
};

const SEXES: Sex[] = ['feminino', 'masculino', 'outro'];
const ACTIVITY: ActivityLevel[] = ['sedentario', 'leve', 'moderado', 'intenso', 'atleta'];
const LEVELS: TrainingLevel[] = ['iniciante', 'intermediario', 'avancado'];

const limparLista = (list: string[], max = 20) =>
  [...new Set(list.map((i) => i.trim()).filter(Boolean))].slice(0, max);

/**
 * Valida o formulário inicial.
 *
 * Altura, peso e objetivo são obrigatórios porque a plataforma inteira
 * depende deles: sem peso não há meta de hidratação calculada, sem objetivo
 * a IA não tem norte, e sem altura não há IMC. Os demais campos refinam.
 */
function validarOnboarding(input: OnboardingInput): string | null {
  if (input.fullName.trim().length < 3) return 'Informe seu nome completo.';

  if (input.heightCm === null) return 'Informe sua altura.';
  if (input.heightCm < 100 || input.heightCm > 250) {
    return 'A altura deve ficar entre 100 e 250 cm.';
  }

  if (input.weightKg === null) return 'Informe seu peso atual.';
  if (input.weightKg < 20 || input.weightKg > 400) {
    return 'O peso deve ficar entre 20 e 400 kg.';
  }

  if (input.goal.trim().length < 3) return 'Descreva seu objetivo principal.';

  if (input.birthDate) {
    const data = new Date(`${input.birthDate}T12:00:00`);
    if (Number.isNaN(data.getTime())) return 'Data de nascimento inválida.';
    const anos = (Date.now() - data.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (anos < 10 || anos > 110) return 'Data de nascimento fora da faixa esperada.';
  }

  if (input.sex && !SEXES.includes(input.sex)) return 'Sexo inválido.';
  if (input.activityLevel && !ACTIVITY.includes(input.activityLevel)) {
    return 'Nível de atividade inválido.';
  }
  if (input.trainingLevel && !LEVELS.includes(input.trainingLevel)) {
    return 'Nível de treino inválido.';
  }
  if (
    input.trainingDays !== null &&
    (input.trainingDays < 0 || input.trainingDays > 7)
  ) {
    return 'Os dias de treino devem ficar entre 0 e 7.';
  }

  return null;
}

/**
 * Conclui o formulário inicial e libera o app.
 *
 * `onboarded_at` é gravado por último, na mesma escrita dos dados: se a
 * atualização falhar, o usuário volta ao formulário em vez de cair num
 * dashboard sem informação nenhuma.
 */
export async function concluirOnboarding(
  input: OnboardingInput,
): Promise<ActionResult> {
  const user = await requirePatientRaw();

  const problem = validarOnboarding(input);
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: input.fullName.trim(),
      phone: input.phone.trim() || null,
      birth_date: input.birthDate,
      sex: input.sex,
      height_cm: input.heightCm,
      goal: input.goal.trim(),
      activity_level: input.activityLevel,
      training_level: input.trainingLevel,
      training_days: input.trainingDays,
      routine: input.routine.trim() || null,
      food_preferences: limparLista(input.foodPreferences),
      food_restrictions: limparLista(input.foodRestrictions),
      health_notes: input.healthNotes.trim() || null,
      onboarded_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) return { ok: false, error: 'Não foi possível salvar seus dados.' };

  /*
    O peso vira uma métrica corporal, não uma coluna do perfil.

    É o mesmo lugar onde o check-in grava, então o gráfico de evolução já
    nasce com o primeiro ponto e a meta de hidratação passa a ter base no
    primeiro acesso — sem nenhum valor fixo no meio do caminho.
  */
  if (input.weightKg !== null) {
    await supabase.from('body_metrics').upsert(
      {
        patient_id: user.id,
        measured_on: new Date().toISOString().slice(0, 10),
        weight_kg: input.weightKg,
      },
      { onConflict: 'patient_id,measured_on' },
    );
  }

  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Sai do onboarding para o app — chamado depois de `concluirOnboarding`. */
export async function irParaInicio(): Promise<never> {
  redirect('/inicio');
}

/* --------------------------------------------------------- PERFIL GERAL --- */

/**
 * Atualização de perfil que vale para os dois papéis.
 * O paciente edita corpo e objetivo; o profissional, nome e especialidade.
 */
export async function atualizarPerfil(input: {
  fullName: string;
  phone?: string;
  goal?: string | null;
  heightCm?: number | null;
  birthDate?: string | null;
  specialty?: string | null;
  timezone?: string;
}): Promise<ActionResult> {
  const user = await requireUser();

  if (input.fullName.trim().length < 3) {
    return { ok: false, error: 'Informe o nome completo.' };
  }
  if (input.heightCm != null && (input.heightCm < 100 || input.heightCm > 250)) {
    return { ok: false, error: 'A altura deve ficar entre 100 e 250 cm.' };
  }

  const patch: Partial<ProfileRow> = { full_name: input.fullName.trim() };

  if (input.phone !== undefined) patch.phone = input.phone.trim() || null;
  if (input.timezone) patch.timezone = input.timezone;

  if (user.role === 'paciente') {
    if (input.goal !== undefined) patch.goal = input.goal?.trim() || null;
    if (input.heightCm !== undefined) patch.height_cm = input.heightCm;
    if (input.birthDate !== undefined) patch.birth_date = input.birthDate;
  } else if (input.specialty !== undefined) {
    // Especialidade só existe para quem atende — deixar o paciente gravar
    // aqui seria abrir caminho para se apresentar como profissional.
    patch.specialty = input.specialty?.trim() || null;
  }

  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);

  if (error) return { ok: false, error: 'Não foi possível salvar o perfil.' };

  revalidatePath('/', 'layout');
  return { ok: true };
}

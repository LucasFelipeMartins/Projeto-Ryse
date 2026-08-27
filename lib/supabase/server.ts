import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import type {
  ActivityLevel,
  Database,
  Sex,
  TrainingLevel,
} from '@/lib/supabase/types';
import { isSupabaseConfigured, supabaseEnv } from '@/lib/supabase/env';

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 *
 * Ler cookies torna a rota dinâmica automaticamente — é por isso que nenhuma
 * página autenticada é pré-renderizada no build (e o build não precisa das
 * variáveis do Supabase).
 */
export async function createClient() {
  // cookies() PRIMEIRO: é o que marca a rota como dinâmica. Se lêssemos as
  // variáveis antes, um throw durante o build derrubaria a pré-renderização
  // em vez de simplesmente pular a página.
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components não podem gravar cookies. O middleware já
          // renova a sessão, então ignorar aqui é seguro.
        }
      },
    },
  });
}

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: 'paciente' | 'profissional';
  avatarUrl: string | null;
  plan: 'completo' | 'nutricao' | 'treino' | null;
  goal: string | null;
  heightCm: number | null;
  waterGoalMl: number;
  waterGoalOverrideMl: number | null;
  kcalGoal: number | null;
  stepsGoal: number;
  professionalId: string | null;
  choseSoloAt: string | null;
  crm: string | null;
  specialty: string | null;
  createdAt: string;
  /* ---------------------------------------------------- onboarding */
  onboardedAt: string | null;
  phone: string | null;
  birthDate: string | null;
  sex: Sex | null;
  activityLevel: ActivityLevel | null;
  trainingLevel: TrainingLevel | null;
  trainingDays: number | null;
  routine: string | null;
  foodPreferences: string[];
  foodRestrictions: string[];
  healthNotes: string | null;
  timezone: string;
};

/**
 * Usuário autenticado + perfil, ou `null`.
 *
 * `cache()` deduplica: várias chamadas dentro do mesmo render batem uma vez só
 * no banco.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();

  // getUser() valida o JWT no servidor de auth — getSession() apenas lê o
  // cookie e não serve para decidir autorização.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  /*
    A lista de colunas fica inline, e não numa constante montada por
    concatenação: o supabase-js deriva o tipo da linha do literal passado
    aqui. Uma string concatenada vira `string` para o TypeScript, e todo o
    retorno perde a tipagem.
  */
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, email, full_name, role, avatar_url, plan, goal, height_cm, water_goal_ml, water_goal_override_ml, kcal_goal, steps_goal, professional_id, chose_solo_at, crm, specialty, created_at, onboarded_at, phone, birth_date, sex, activity_level, training_level, training_days, routine, food_preferences, food_restrictions, health_notes, timezone',
    )
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
    avatarUrl: profile.avatar_url,
    plan: profile.plan,
    goal: profile.goal,
    heightCm: profile.height_cm,
    waterGoalMl: profile.water_goal_ml,
    waterGoalOverrideMl: profile.water_goal_override_ml,
    kcalGoal: profile.kcal_goal,
    stepsGoal: profile.steps_goal,
    professionalId: profile.professional_id,
    choseSoloAt: profile.chose_solo_at,
    crm: profile.crm,
    specialty: profile.specialty,
    createdAt: profile.created_at,
    onboardedAt: profile.onboarded_at,
    phone: profile.phone,
    birthDate: profile.birth_date,
    sex: profile.sex,
    activityLevel: profile.activity_level,
    trainingLevel: profile.training_level,
    trainingDays: profile.training_days,
    routine: profile.routine,
    foodPreferences: profile.food_preferences ?? [],
    foodRestrictions: profile.food_restrictions ?? [],
    healthNotes: profile.health_notes,
    timezone: profile.timezone ?? 'America/Sao_Paulo',
  };
});

/** Para onde cada papel vai depois de entrar. */
export const homeFor = (role: 'paciente' | 'profissional') =>
  role === 'profissional' ? '/pro' : '/inicio';

/** Onde cada papel faz login. */
export const loginFor = (role: 'paciente' | 'profissional') =>
  role === 'profissional' ? '/pro/entrar' : '/entrar';

/**
 * Exige sessão. Redireciona para o login se não houver.
 *
 * A checagem de configuração vem primeiro porque layouts filhos são
 * renderizados em paralelo com o pai no App Router: um guard no layout de
 * cima não impede este código de rodar.
 */
export async function requireUser(): Promise<SessionUser> {
  if (!isSupabaseConfigured()) redirect('/configurar');

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect('/entrar');

  const user = await getSessionUser();

  /*
    Há sessão no auth mas não há perfil — o gatilho handle_new_user não
    rodou, ou a linha foi apagada. Mandar para /entrar não resolveria: o
    cookie continua válido, e o app voltaria para cá em laço. A saída é
    encerrar a sessão de fato, o que só um Route Handler consegue fazer.
  */
  if (!user) redirect('/auth/sair?motivo=perfil_ausente');

  return user;
}

/**
 * Exige que o usuário seja profissional.
 *
 * O middleware já barra a rota, mas repetir a checagem aqui garante que um
 * Server Component nunca vaze dado de gestão caso alguém alcance a rota por
 * outro caminho.
 */
export async function requireProfessional(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'profissional') redirect('/inicio');
  return user;
}

/**
 * Exige que o usuário seja paciente **com onboarding concluído**.
 *
 * O formulário inicial é a porta: sem ele o app não tem peso, altura nem
 * objetivo, e todo o resto — meta de hidratação, contexto da IA, dieta —
 * sairia genérico. Por isso o gate mora aqui, no mesmo lugar que já decide
 * papel, e não numa checagem espalhada por cada página.
 */
export async function requirePatient(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'paciente') redirect('/pro');
  if (!user.onboardedAt) redirect('/onboarding');
  return user;
}

/**
 * Paciente autenticado, com ou sem onboarding.
 * Usado pelas próprias telas do onboarding, que rodariam em laço com
 * `requirePatient()`.
 */
export async function requirePatientRaw(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'paciente') redirect('/pro');
  return user;
}

/** Peso mais recente do paciente, em kg — base da meta de hidratação. */
export const getLatestWeight = cache(
  async (patientId: string): Promise<number | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from('body_metrics')
      .select('weight_kg')
      .eq('patient_id', patientId)
      .not('weight_kg', 'is', null)
      .order('measured_on', { ascending: false })
      .limit(1)
      .maybeSingle();

    return data?.weight_kg ?? null;
  },
);

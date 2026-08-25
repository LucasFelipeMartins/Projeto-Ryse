import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { Database } from '@/lib/supabase/types';
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
  kcalGoal: number | null;
  stepsGoal: number;
  professionalId: string | null;
  crm: string | null;
  specialty: string | null;
  createdAt: string;
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

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, email, full_name, role, avatar_url, plan, goal, height_cm, water_goal_ml, kcal_goal, steps_goal, professional_id, crm, specialty, created_at',
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
    kcalGoal: profile.kcal_goal,
    stepsGoal: profile.steps_goal,
    professionalId: profile.professional_id,
    crm: profile.crm,
    specialty: profile.specialty,
    createdAt: profile.created_at,
  };
});

/**
 * Exige sessão. Redireciona para o login se não houver.
 *
 * A checagem de configuração vem primeiro porque layouts filhos são
 * renderizados em paralelo com o pai no App Router: um guard no layout de
 * cima não impede este código de rodar.
 */
export async function requireUser(): Promise<SessionUser> {
  if (!isSupabaseConfigured()) redirect('/configurar');

  const user = await getSessionUser();
  if (!user) redirect('/entrar');
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

/** Exige que o usuário seja paciente. */
export async function requirePatient(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'paciente') redirect('/pro');
  return user;
}

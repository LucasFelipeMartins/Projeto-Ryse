import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getQuotaStatus, type QuotaStatus } from '@/lib/ai/limits';
import type { ContextScope } from '@/lib/ai/context';
import type {
  AiDetailLevel,
  AiOutputKind,
  AiPriority,
  AiRequestKind,
} from '@/lib/supabase/types';
import type { AiDiet, AiReport, AiWorkoutPlan } from '@/lib/ai/schemas';

/** Leituras do que a IA produziu e do que ainda pode produzir. */

export type StoredOutput<T> = {
  id: string;
  title: string;
  content: T;
  model: string | null;
  createdAt: string;
};

async function latestOutput<T>(
  patientId: string,
  kind: AiOutputKind,
): Promise<StoredOutput<T> | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('ai_outputs')
    .select('id, title, content, model, created_at')
    .eq('patient_id', patientId)
    .eq('kind', kind)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    title: data.title,
    content: data.content as T,
    model: data.model,
    createdAt: data.created_at,
  };
}

export const getLatestReport = (patientId: string, kind: AiOutputKind) =>
  latestOutput<AiReport>(patientId, kind);

export const getLatestDiet = (patientId: string) =>
  latestOutput<AiDiet>(patientId, 'dieta');

export const getLatestWorkoutPlan = (patientId: string) =>
  latestOutput<AiWorkoutPlan>(patientId, 'ficha_treino');

/** Situação da cota — a tela usa isso para explicar o botão antes do clique. */
export async function getQuotas(
  profileId: string,
  kinds: AiRequestKind[],
  timezone: string,
): Promise<Record<string, QuotaStatus>> {
  return getQuotaStatus(profileId, kinds, timezone);
}

/* ------------------------------------------------- PROTOCOLO DE ANÁLISE -- */

export type AnalysisProtocolView = {
  objective: string;
  priority: AiPriority;
  scopes: ContextScope[];
  detailLevel: AiDetailLevel;
  notes: string;
  updatedAt: string;
};

export async function getAnalysisProtocol(
  patientId: string,
): Promise<AnalysisProtocolView | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('ai_protocols')
    .select('objective, priority, scopes, detail_level, notes, updated_at')
    .eq('patient_id', patientId)
    .maybeSingle();

  if (!data) return null;

  return {
    objective: data.objective,
    priority: data.priority,
    scopes: data.scopes as ContextScope[],
    detailLevel: data.detail_level,
    notes: data.notes ?? '',
    updatedAt: data.updated_at,
  };
}

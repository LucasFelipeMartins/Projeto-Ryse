'use server';

import { revalidatePath } from 'next/cache';
import { createClient, requireProfessional } from '@/lib/supabase/server';
import { ALL_SCOPES, type ContextScope } from '@/lib/ai/context';
import type { ActionResult } from '@/lib/types';
import type { AiDetailLevel, AiPriority } from '@/lib/supabase/types';

/**
 * Protocolo de análise da IA.
 *
 * É a pré-definição que o profissional configura por paciente: objetivo,
 * prioridade, o que a IA pode olhar, quanto detalhe e as observações dele.
 * A camada de contexto lê isso antes de montar qualquer prompt — desmarcar
 * "exames" aqui faz a consulta de exames nem sair do banco.
 *
 * Uma linha por paciente: salvar substitui, em vez de acumular versões que
 * ninguém saberia qual está valendo.
 */

export type AiProtocolInput = {
  patientId: string;
  objective: string;
  priority: AiPriority;
  scopes: ContextScope[];
  detailLevel: AiDetailLevel;
  notes: string;
};

const PRIORITIES: AiPriority[] = ['baixa', 'media', 'alta'];
const LEVELS: AiDetailLevel[] = ['resumido', 'padrao', 'completo'];

const MAX_OBJECTIVE = 160;
const MAX_NOTES = 2000;

function validate(input: AiProtocolInput): string | null {
  if (input.objective.trim().length < 3) {
    return 'Descreva o objetivo principal com pelo menos 3 caracteres.';
  }
  if (input.objective.length > MAX_OBJECTIVE) {
    return `O objetivo deve ter no máximo ${MAX_OBJECTIVE} caracteres.`;
  }
  if (!PRIORITIES.includes(input.priority)) return 'Prioridade inválida.';
  if (!LEVELS.includes(input.detailLevel)) return 'Nível de detalhamento inválido.';
  if (input.scopes.length === 0) {
    return 'Selecione ao menos uma área para a IA analisar.';
  }
  if (input.notes.length > MAX_NOTES) {
    return `As observações devem ter no máximo ${MAX_NOTES} caracteres.`;
  }
  return null;
}

/** Cria ou atualiza o protocolo do paciente. */
export async function salvarProtocoloDeAnalise(
  input: AiProtocolInput,
): Promise<ActionResult> {
  const pro = await requireProfessional();

  const problem = validate(input);
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();

  // O vínculo é a autorização. A RLS repete a checagem, mas errar aqui
  // devolveria uma mensagem críptica do Postgres em vez de uma frase útil.
  const { data: patient } = await supabase
    .from('profiles')
    .select('id, professional_id')
    .eq('id', input.patientId)
    .maybeSingle();

  if (!patient || patient.professional_id !== pro.id) {
    return { ok: false, error: 'Este paciente não está vinculado a você.' };
  }

  const scopes = input.scopes.filter((s) => ALL_SCOPES.includes(s));

  const { error } = await supabase.from('ai_protocols').upsert(
    {
      patient_id: input.patientId,
      professional_id: pro.id,
      objective: input.objective.trim(),
      priority: input.priority,
      scopes,
      detail_level: input.detailLevel,
      notes: input.notes.trim() || null,
    },
    { onConflict: 'patient_id' },
  );

  if (error) return { ok: false, error: 'Não foi possível salvar o protocolo.' };

  revalidatePath(`/pro/pacientes/${input.patientId}`);
  return { ok: true };
}

/** Remove o protocolo — a IA volta a analisar tudo, sem recorte. */
export async function removerProtocoloDeAnalise(
  patientId: string,
): Promise<ActionResult> {
  await requireProfessional();
  const supabase = await createClient();

  const { error } = await supabase
    .from('ai_protocols')
    .delete()
    .eq('patient_id', patientId);

  if (error) return { ok: false, error: 'Não foi possível remover o protocolo.' };

  revalidatePath(`/pro/pacientes/${patientId}`);
  return { ok: true };
}

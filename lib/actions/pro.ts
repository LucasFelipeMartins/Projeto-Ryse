'use server';

import { revalidatePath } from 'next/cache';
import { createClient, requireProfessional } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';

/* ------------------------------------------------------- DECISÃO CLÍNICA */

export type Decision = 'aprovar' | 'editar' | 'rejeitar';

const STATUS_BY_DECISION = {
  aprovar: 'aprovado',
  editar: 'editado',
  rejeitar: 'rejeitado',
} as const;

/**
 * Registra a decisão do profissional sobre uma proposta da IA.
 *
 * O `decided_at` e o `decided_by` são carimbados pelo trigger
 * `stamp_review_decision`, para que o registro não dependa do cliente.
 */
export async function decideReview(
  reviewId: string,
  decision: Decision,
  note: string,
): Promise<ActionResult> {
  const pro = await requireProfessional();

  if (decision === 'rejeitar' && note.trim().length < 3) {
    return { ok: false, error: 'Descreva o motivo da rejeição.' };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('ai_reviews')
    .update({
      status: STATUS_BY_DECISION[decision],
      decision_note: note.trim() || null,
    })
    .eq('id', reviewId)
    .eq('professional_id', pro.id)
    .eq('status', 'pendente'); // idempotente: não redecide um caso já fechado

  if (error) return { ok: false, error: 'Não foi possível registrar a decisão.' };

  revalidatePath('/pro/revisao', 'layout');
  revalidatePath('/pro');
  return { ok: true };
}

/* ----------------------------------------------------- PERFIL DO PROFISSIONAL */

export async function updateProfessionalProfile(input: {
  fullName: string;
  specialty: string | null;
}): Promise<ActionResult> {
  const pro = await requireProfessional();

  if (input.fullName.trim().length < 3) {
    return { ok: false, error: 'Informe seu nome completo.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: input.fullName.trim(),
      specialty: input.specialty?.trim() || null,
    })
    .eq('id', pro.id);

  if (error) return { ok: false, error: 'Não foi possível salvar.' };

  revalidatePath('/pro', 'layout');
  return { ok: true };
}

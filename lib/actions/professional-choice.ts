'use server';

import { revalidatePath } from 'next/cache';
import { createClient, requirePatient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';

/**
 * Vincula o paciente a um profissional.
 *
 * A validação de que o alvo é mesmo um profissional acontece no banco, pelo
 * gatilho `profiles_validate_link`. Fazer só aqui seria frágil: a RLS deixa o
 * paciente atualizar o próprio perfil, então a trava precisa estar no lugar
 * que ninguém contorna.
 */
export async function chooseProfessional(professionalId: string): Promise<ActionResult> {
  const user = await requirePatient();
  const supabase = await createClient();

  const { error } = await supabase
    .from('profiles')
    .update({ professional_id: professionalId, chose_solo_at: null })
    .eq('id', user.id);

  if (error) {
    // A mensagem do gatilho é legível; qualquer outra vira texto genérico.
    return {
      ok: false,
      error: error.message.includes('profissional')
        ? 'Esse profissional não está mais disponível. Escolha outro.'
        : 'Não foi possível concluir a escolha.',
    };
  }

  // Abre o canal de mensagens já vinculado.
  await supabase.rpc('ensure_conversation', { target_patient: user.id });

  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Segue sem profissional, contando apenas com a análise da IA. */
export async function goSolo(): Promise<ActionResult> {
  const user = await requirePatient();
  const supabase = await createClient();

  const { error } = await supabase
    .from('profiles')
    .update({ professional_id: null, chose_solo_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) return { ok: false, error: 'Não foi possível salvar sua escolha.' };

  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Desfaz o vínculo e volta ao estado de "ainda não escolhi". */
export async function leaveProfessional(): Promise<ActionResult> {
  const user = await requirePatient();
  const supabase = await createClient();

  const { error } = await supabase
    .from('profiles')
    .update({ professional_id: null, chose_solo_at: null })
    .eq('id', user.id);

  if (error) return { ok: false, error: 'Não foi possível desfazer o vínculo.' };

  revalidatePath('/', 'layout');
  return { ok: true };
}

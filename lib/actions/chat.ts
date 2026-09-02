'use server';

import { revalidatePath } from 'next/cache';
import { createClient, requireUser } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';

const MAX_BODY = 4000;

/**
 * Envia uma mensagem. O `sender_kind` vem do papel do usuário autenticado —
 * nunca do cliente — para que ninguém escreva se passando por outro perfil.
 */
export async function sendMessage(
  conversationId: string,
  body: string,
): Promise<ActionResult> {
  const user = await requireUser();

  const text = body.trim();
  if (!text) return { ok: false, error: 'Escreva alguma coisa antes de enviar.' };
  if (text.length > MAX_BODY) {
    return { ok: false, error: 'Mensagem muito longa.' };
  }

  const supabase = await createClient();

  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: user.id,
    sender_kind: user.role === 'profissional' ? 'profissional' : 'paciente',
    body: text,
  });

  if (error) return { ok: false, error: 'Não foi possível enviar a mensagem.' };

  revalidatePath('/mensagens');
  revalidatePath('/pro/mensagens');
  return { ok: true };
}

/** Marca como lidas as mensagens que o usuário recebeu nesta conversa. */
export async function markConversationRead(conversationId: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const fromOther = user.role === 'profissional' ? 'paciente' : 'profissional';

  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('sender_kind', fromOther)
    .is('read_at', null);

  if (error) return { ok: false, error: 'Não foi possível marcar como lida.' };
  return { ok: true };
}

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { relativeTime } from '@/lib/utils';
import type { SenderKind } from '@/lib/supabase/types';

export type MessageView = {
  id: string;
  from: 'me' | 'them' | 'ai';
  text: string;
  time: string;
};

export type ConversationView = {
  id: string;
  peerId: string;
  peerName: string;
  peerMeta: string;
  last: string;
  time: string;
  unread: number;
};

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function toView(
  rows: { id: string; sender_id: string | null; sender_kind: SenderKind; body: string; created_at: string }[],
  viewerId: string,
): MessageView[] {
  return rows.map((m) => ({
    id: m.id,
    from: m.sender_kind === 'ia' ? 'ai' : m.sender_id === viewerId ? 'me' : 'them',
    text: m.body,
    time: clock(m.created_at),
  }));
}

/* ------------------------------------------------- CONVERSA DO PACIENTE -- */

/** O paciente tem uma única conversa: com o profissional responsável. */
export async function getPatientConversation(patientId: string) {
  const supabase = await createClient();

  const { data: convoId } = await supabase.rpc('ensure_conversation', {
    target_patient: patientId,
  });

  if (!convoId) return null;

  const [{ data: convo }, { data: messages }] = await Promise.all([
    supabase
      .from('conversations')
      .select('id, professional_id, profiles!conversations_professional_id_fkey(full_name, specialty)')
      .eq('id', convoId)
      .single(),
    supabase
      .from('messages')
      .select('id, sender_id, sender_kind, body, created_at')
      .eq('conversation_id', convoId)
      .order('created_at')
      .limit(200),
  ]);

  if (!convo) return null;

  const pro = Array.isArray(convo.profiles) ? convo.profiles[0] : convo.profiles;

  return {
    id: convo.id,
    peerName: pro?.full_name ?? 'Seu profissional',
    peerMeta: pro?.specialty ?? 'Profissional responsável',
    messages: toView(messages ?? [], patientId),
  };
}

/* ------------------------------------------------- CAIXA DO PROFISSIONAL - */

export async function getProConversations(
  professionalId: string,
): Promise<ConversationView[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('conversations')
    .select(
      'id, patient_id, last_message_at, profiles!conversations_patient_id_fkey(full_name, plan)',
    )
    .eq('professional_id', professionalId)
    .order('last_message_at', { ascending: false });

  const convos = data ?? [];
  if (convos.length === 0) return [];

  // Última mensagem e não lidas de todas as conversas em uma consulta.
  const { data: messages } = await supabase
    .from('messages')
    .select('conversation_id, body, created_at, read_at, sender_kind')
    .in(
      'conversation_id',
      convos.map((c) => c.id),
    )
    .order('created_at', { ascending: false });

  const lastByConvo = new Map<string, { body: string; at: string }>();
  const unreadByConvo = new Map<string, number>();

  for (const m of messages ?? []) {
    if (!lastByConvo.has(m.conversation_id)) {
      lastByConvo.set(m.conversation_id, { body: m.body, at: m.created_at });
    }
    if (m.sender_kind === 'paciente' && !m.read_at) {
      unreadByConvo.set(m.conversation_id, (unreadByConvo.get(m.conversation_id) ?? 0) + 1);
    }
  }

  const PLAN_LABEL: Record<string, string> = {
    completo: 'Ryse Completo',
    nutricao: 'Ryse Nutrição',
    treino: 'Ryse Treino',
  };

  return convos.map((c) => {
    const patient = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
    const last = lastByConvo.get(c.id);

    return {
      id: c.id,
      peerId: c.patient_id,
      peerName: patient?.full_name ?? 'Paciente',
      peerMeta: patient?.plan ? PLAN_LABEL[patient.plan] : 'Sem plano',
      last: last?.body ?? 'Sem mensagens ainda.',
      time: last ? relativeTime(last.at) : '—',
      unread: unreadByConvo.get(c.id) ?? 0,
    };
  });
}

export async function getMessages(
  conversationId: string,
  viewerId: string,
): Promise<MessageView[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('messages')
    .select('id, sender_id, sender_kind, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at')
    .limit(200);

  return toView(data ?? [], viewerId);
}

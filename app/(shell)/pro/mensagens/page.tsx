import { ProInboxView } from '@/components/features/chat';
import { getMessages, getProConversations } from '@/lib/queries/chat';
import { requireProfessional } from '@/lib/supabase/server';

export const metadata = { title: 'Mensagens' };

export default async function ProMensagensPage({
  searchParams,
}: {
  searchParams: Promise<{ conversa?: string }>;
}) {
  const pro = await requireProfessional();
  const { conversa } = await searchParams;

  const conversations = await getProConversations(pro.id);

  // Sem parâmetro, abre a conversa mais recente.
  const activeId = conversa ?? conversations[0]?.id ?? null;
  const messages = activeId ? await getMessages(activeId, pro.id) : [];

  return (
    <ProInboxView
      conversations={conversations}
      activeId={activeId}
      messages={messages}
      viewerId={pro.id}
    />
  );
}

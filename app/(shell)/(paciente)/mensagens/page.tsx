import { MessageSquareOff } from 'lucide-react';
import { Card, EmptyState, PageIntro } from '@/components/ui';
import { PatientChatView } from '@/components/features/chat';
import { getPatientConversation } from '@/lib/queries/chat';
import { requirePatient } from '@/lib/supabase/server';

export const metadata = { title: 'Mensagens' };

export default async function MensagensPage() {
  const user = await requirePatient();
  const conversation = await getPatientConversation(user.id);

  if (!conversation) {
    return (
      <div className="space-y-6">
        <PageIntro title="Mensagens" />
        <Card>
          <EmptyState
            icon={MessageSquareOff}
            title="Nenhuma conversa disponível"
            description="O canal de mensagens abre assim que sua clínica vincular você a um profissional."
          />
        </Card>
      </div>
    );
  }

  return <PatientChatView conversation={conversation} />;
}

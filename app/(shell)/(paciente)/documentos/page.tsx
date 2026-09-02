import { DocumentosView } from '@/components/features/documentos-view';
import { AiReportPanel, AiUnavailableCard } from '@/components/features/ai-panels';
import { LiveRefresh } from '@/components/features/live-refresh';
import { getDocuments, getDocumentsThisWeek } from '@/lib/queries/documents';
import { getLatestReport, getQuotas } from '@/lib/queries/ai';
import { isAiConfigured } from '@/lib/ai/provider';
import { requirePatient } from '@/lib/supabase/server';
import type { AiReport } from '@/lib/ai/schemas';

export const metadata = { title: 'Meus documentos' };

const TABELAS_AO_VIVO = ['health_documents', 'exams', 'ai_outputs'];

export default async function DocumentosPage() {
  const user = await requirePatient();

  const [documents, usedThisWeek, relatorio, quotas] = await Promise.all([
    getDocuments(user.id),
    getDocumentsThisWeek(user.id),
    getLatestReport(user.id, 'relatorio_exames'),
    getQuotas(user.id, ['relatorio_exames'], user.timezone),
  ]);

  return (
    <div className="space-y-6">
      <LiveRefresh patientId={user.id} tables={TABELAS_AO_VIVO} channel="documentos" />

      <DocumentosView documents={documents} usedThisWeek={usedThisWeek} />

      {isAiConfigured() ? (
        <AiReportPanel
          area="exames"
          quota={quotas.relatorio_exames}
          initial={(relatorio?.content as AiReport | undefined) ?? null}
          initialAt={relatorio?.createdAt ?? null}
        />
      ) : (
        <AiUnavailableCard area="relatórios de exames" />
      )}
    </div>
  );
}

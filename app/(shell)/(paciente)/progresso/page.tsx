import { ProgressoView } from '@/components/features/progresso-view';
import { AiReportPanel, AiUnavailableCard } from '@/components/features/ai-panels';
import { LiveRefresh } from '@/components/features/live-refresh';
import { getProgress } from '@/lib/queries/patient';
import { getLatestReport, getQuotas } from '@/lib/queries/ai';
import { isAiConfigured } from '@/lib/ai/provider';
import { requirePatient } from '@/lib/supabase/server';
import type { AiReport } from '@/lib/ai/schemas';

export const metadata = { title: 'Progresso' };

/*
  Progresso é a tela mais "viva" do app: peso, medidas, sessões, refeições,
  exames e check-ins alimentam os mesmos gráficos. Todas entram na escuta.
*/
const TABELAS_AO_VIVO = [
  'body_metrics',
  'checkins',
  'meal_logs',
  'workout_sessions',
  'exams',
  'ai_outputs',
];

export default async function ProgressoPage() {
  const user = await requirePatient();

  const [data, saude, exames, quotas] = await Promise.all([
    getProgress(user.id),
    getLatestReport(user.id, 'relatorio_saude'),
    getLatestReport(user.id, 'relatorio_exames'),
    getQuotas(user.id, ['relatorio_saude', 'relatorio_exames'], user.timezone),
  ]);

  const iaAtiva = isAiConfigured();

  return (
    <div className="space-y-6">
      <LiveRefresh patientId={user.id} tables={TABELAS_AO_VIVO} channel="progresso" />

      <ProgressoView data={data} since={user.createdAt} />

      {iaAtiva ? (
        <>
          <AiReportPanel
            area="saude"
            quota={quotas.relatorio_saude}
            initial={(saude?.content as AiReport | undefined) ?? null}
            initialAt={saude?.createdAt ?? null}
          />

          <AiReportPanel
            area="exames"
            quota={quotas.relatorio_exames}
            initial={(exames?.content as AiReport | undefined) ?? null}
            initialAt={exames?.createdAt ?? null}
          />
        </>
      ) : (
        <AiUnavailableCard area="relatórios de saúde e exames" />
      )}
    </div>
  );
}

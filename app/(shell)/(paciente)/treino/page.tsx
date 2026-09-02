import { TreinoView } from '@/components/features/treino-view';
import {
  AiReportPanel,
  AiUnavailableCard,
  AiWorkoutPanel,
} from '@/components/features/ai-panels';
import { LiveRefresh } from '@/components/features/live-refresh';
import { getTraining } from '@/lib/queries/patient';
import { getLatestReport, getLatestWorkoutPlan, getQuotas } from '@/lib/queries/ai';
import { isAiConfigured } from '@/lib/ai/provider';
import { requirePatient } from '@/lib/supabase/server';
import type { AiReport, AiWorkoutPlan } from '@/lib/ai/schemas';

export const metadata = { title: 'Treino' };

const TABELAS_AO_VIVO = ['workout_sessions', 'ai_outputs'];

export default async function TreinoPage() {
  const user = await requirePatient();

  const [{ plan, today, week }, ficha, relatorio, quotas] = await Promise.all([
    getTraining(user.id),
    getLatestWorkoutPlan(user.id),
    getLatestReport(user.id, 'relatorio_treino'),
    getQuotas(user.id, ['ficha_treino', 'relatorio_treino'], user.timezone),
  ]);

  const iaAtiva = isAiConfigured();

  return (
    <div className="space-y-6">
      <LiveRefresh patientId={user.id} tables={TABELAS_AO_VIVO} channel="treino" />

      <TreinoView plan={plan} today={today} week={week} />

      {iaAtiva ? (
        <>
          <AiWorkoutPanel
            quota={quotas.ficha_treino}
            initial={(ficha?.content as AiWorkoutPlan | undefined) ?? null}
            initialAt={ficha?.createdAt ?? null}
          />

          <AiReportPanel
            area="treino"
            quota={quotas.relatorio_treino}
            initial={(relatorio?.content as AiReport | undefined) ?? null}
            initialAt={relatorio?.createdAt ?? null}
          />
        </>
      ) : (
        <AiUnavailableCard area="fichas e relatórios" />
      )}
    </div>
  );
}

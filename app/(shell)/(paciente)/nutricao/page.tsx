import { NutricaoView } from '@/components/features/nutricao-view';
import { AiDietPanel, AiUnavailableCard } from '@/components/features/ai-panels';
import { LiveRefresh } from '@/components/features/live-refresh';
import { getNutrition } from '@/lib/queries/patient';
import { getLatestDiet, getQuotas, getLatestReport } from '@/lib/queries/ai';
import { AiReportPanel } from '@/components/features/ai-panels';
import { isAiConfigured } from '@/lib/ai/provider';
import { requirePatient } from '@/lib/supabase/server';
import type { AiDiet, AiReport } from '@/lib/ai/schemas';

export const metadata = { title: 'Nutrição' };

const TABELAS_AO_VIVO = ['meal_logs', 'ai_outputs'];

export default async function NutricaoPage() {
  const user = await requirePatient();

  const [data, diet, relatorio, quotas] = await Promise.all([
    getNutrition(user.id),
    getLatestDiet(user.id),
    getLatestReport(user.id, 'relatorio_nutricao'),
    getQuotas(user.id, ['dieta', 'relatorio_nutricao'], user.timezone),
  ]);

  const iaAtiva = isAiConfigured();

  return (
    <div className="space-y-6">
      <LiveRefresh patientId={user.id} tables={TABELAS_AO_VIVO} channel="nutricao" />

      <NutricaoView data={data} />

      {/*
        As ações de IA ficam depois do plano vigente de propósito: o que o
        profissional prescreveu é o protagonista da tela; a sugestão da
        máquina entra como complemento, não como substituta.
      */}
      {iaAtiva ? (
        <>
          <AiDietPanel
            quota={quotas.dieta}
            initial={(diet?.content as AiDiet | undefined) ?? null}
            initialAt={diet?.createdAt ?? null}
          />

          <AiReportPanel
            area="nutricao"
            quota={quotas.relatorio_nutricao}
            initial={(relatorio?.content as AiReport | undefined) ?? null}
            initialAt={relatorio?.createdAt ?? null}
          />
        </>
      ) : (
        <AiUnavailableCard area="dieta e relatórios" />
      )}
    </div>
  );
}

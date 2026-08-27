import { notFound } from 'next/navigation';
import { PacienteDetalhe } from '@/components/features/paciente-detalhe';
import { ProtocoloIA } from '@/components/features/protocolo-ia';
import { getPatientDetail } from '@/lib/queries/pro';
import { getAnalysisProtocol, getQuotas } from '@/lib/queries/ai';
import { isAiConfigured } from '@/lib/ai/provider';
import { requireProfessional } from '@/lib/supabase/server';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pro = await requireProfessional();
  const patient = await getPatientDetail(id, pro.id);
  return { title: patient?.name ?? 'Paciente' };
}

export default async function PacienteDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pro = await requireProfessional();

  const patient = await getPatientDetail(id, pro.id);
  if (!patient) notFound();

  const [protocol, quotas] = await Promise.all([
    getAnalysisProtocol(id),
    // A cota debitada é a do profissional: pedir um parecer não consome a
    // solicitação mensal do paciente.
    getQuotas(pro.id, ['analise_protocolo'], pro.timezone),
  ]);

  return (
    <div className="space-y-6">
      <PacienteDetalhe patient={patient} />

      <ProtocoloIA
        patientId={id}
        patientName={patient.name}
        initial={protocol}
        quotaUsed={quotas.analise_protocolo.used}
        quotaAvailableOn={quotas.analise_protocolo.availableOn}
        aiEnabled={isAiConfigured()}
      />
    </div>
  );
}

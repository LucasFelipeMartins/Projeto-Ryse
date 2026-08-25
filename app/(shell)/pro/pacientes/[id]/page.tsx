import { notFound } from 'next/navigation';
import { PacienteDetalhe } from '@/components/features/paciente-detalhe';
import { getPatientDetail } from '@/lib/queries/pro';
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

  return <PacienteDetalhe patient={patient} />;
}

import { notFound } from 'next/navigation';
import { PacienteDetalhe } from '@/components/features/paciente-detalhe';
import { patients } from '@/lib/data';

export function generateStaticParams() {
  return patients.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = patients.find((p) => p.id === id);
  return { title: patient?.name ?? 'Paciente' };
}

export default async function PacienteDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patient = patients.find((p) => p.id === id);
  if (!patient) notFound();

  return <PacienteDetalhe patient={patient} />;
}

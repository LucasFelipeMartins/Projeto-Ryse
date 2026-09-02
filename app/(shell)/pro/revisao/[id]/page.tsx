import { notFound } from 'next/navigation';
import { RevisaoDetalhe } from '@/components/features/revisao-detalhe';
import { getReview } from '@/lib/queries/pro';
import { requireProfessional } from '@/lib/supabase/server';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pro = await requireProfessional();
  const item = await getReview(id, pro.id);
  return { title: item ? `Revisão · ${item.patient}` : 'Revisão' };
}

export default async function RevisaoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pro = await requireProfessional();
  const item = await getReview(id, pro.id);

  if (!item) notFound();

  return <RevisaoDetalhe item={item} />;
}

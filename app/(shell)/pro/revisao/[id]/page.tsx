import { notFound } from 'next/navigation';
import { RevisaoDetalhe } from '@/components/features/revisao-detalhe';
import { reviewQueue } from '@/lib/data';

export function generateStaticParams() {
  return reviewQueue.map((c) => ({ id: c.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = reviewQueue.find((c) => c.id === id);
  return { title: item ? `Revisão · ${item.patient}` : 'Revisão' };
}

export default async function RevisaoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = reviewQueue.find((c) => c.id === id);
  if (!item) notFound();

  return <RevisaoDetalhe item={item} />;
}

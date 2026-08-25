import { DocumentosView } from '@/components/features/documentos-view';
import { getDocuments, getDocumentsThisWeek } from '@/lib/queries/documents';
import { requirePatient } from '@/lib/supabase/server';

export const metadata = { title: 'Meus documentos' };

export default async function DocumentosPage() {
  const user = await requirePatient();

  const [documents, usedThisWeek] = await Promise.all([
    getDocuments(user.id),
    getDocumentsThisWeek(user.id),
  ]);

  return <DocumentosView documents={documents} usedThisWeek={usedThisWeek} />;
}

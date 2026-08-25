import { DocumentosView } from '@/components/features/documentos-view';
import { getDocuments, getDocumentsToday } from '@/lib/queries/documents';
import { requirePatient } from '@/lib/supabase/server';

export const metadata = { title: 'Meus documentos' };

export default async function DocumentosPage() {
  const user = await requirePatient();

  const [documents, usedToday] = await Promise.all([
    getDocuments(user.id),
    getDocumentsToday(user.id),
  ]);

  return <DocumentosView documents={documents} usedToday={usedToday} />;
}

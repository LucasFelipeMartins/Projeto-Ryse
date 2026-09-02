import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { relativeTime } from '@/lib/utils';
import type { DocumentKind, ExtractedMarker } from '@/lib/ai/analyzer';

export type DocumentStatus =
  | 'validando'
  | 'rejeitado'
  | 'aguardando_analise'
  | 'analisado'
  | 'erro';

export type DocumentView = {
  id: string;
  name: string;
  mime: string;
  sizeBytes: number;
  pageCount: number | null;
  status: DocumentStatus;
  kind: DocumentKind | null;
  rejectReason: string | null;
  summary: string | null;
  collectedOn: string | null;
  lab: string | null;
  markers: ExtractedMarker[];
  highlights: string[];
  sentAt: string;
};

export async function getDocuments(patientId: string): Promise<DocumentView[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('health_documents')
    .select(
      'id, original_name, mime_type, size_bytes, page_count, status, kind, reject_reason, summary, collected_on, lab, markers, highlights, created_at',
    )
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(50);

  return (data ?? []).map((d) => ({
    id: d.id,
    name: d.original_name,
    mime: d.mime_type,
    sizeBytes: d.size_bytes,
    pageCount: d.page_count,
    status: d.status,
    kind: d.kind,
    rejectReason: d.reject_reason,
    summary: d.summary,
    collectedOn: d.collected_on,
    lab: d.lab,
    markers: Array.isArray(d.markers) ? (d.markers as unknown as ExtractedMarker[]) : [],
    highlights: d.highlights ?? [],
    sentAt: relativeTime(d.created_at),
  }));
}

/** Quantos documentos o paciente já enviou nesta semana. */
export async function getDocumentsThisWeek(patientId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('documents_this_week', { target_patient: patientId });
  return data ?? 0;
}

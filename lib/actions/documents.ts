'use server';

import { revalidatePath } from 'next/cache';
import { createClient, requirePatient } from '@/lib/supabase/server';
import { validateBytes, MAX_UPLOADS_PER_DAY } from '@/lib/validation/document';
import { checkPdfContent } from '@/lib/validation/health-content';
import { getAnalyzer, type AnalyzerInput } from '@/lib/ai/analyzer';
import type { ActionResult } from '@/lib/types';

export type UploadResult =
  | { ok: true; documentId: string; status: string; message: string }
  | { ok: false; error: string; layer: 'consentimento' | 'limite' | 'arquivo' | 'conteudo' | 'ia' };

const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Recebe um documento de saúde e o faz atravessar as camadas de verificação.
 *
 * A ordem é deliberada: o que é barato e determinístico roda antes do que é
 * caro. Um arquivo que falha na assinatura binária nunca chega a consumir
 * cota da API de IA.
 */
export async function uploadHealthDocument(formData: FormData): Promise<UploadResult> {
  const user = await requirePatient();
  const supabase = await createClient();

  /* ------------------------------------------- 0. consentimento (LGPD) */

  if (formData.get('consentimento') !== 'sim') {
    return {
      ok: false,
      layer: 'consentimento',
      error: 'Autorize o envio para análise antes de continuar.',
    };
  }

  /* -------------------------------------------------- 1. limite diário */

  const { data: usedToday } = await supabase.rpc('documents_today', {
    target_patient: user.id,
  });

  if ((usedToday ?? 0) >= MAX_UPLOADS_PER_DAY) {
    return {
      ok: false,
      layer: 'limite',
      error: `Você já enviou ${MAX_UPLOADS_PER_DAY} documentos hoje. Tente novamente amanhã.`,
    };
  }

  /* ------------------------------------------------- 2. arquivo (bytes) */

  const file = formData.get('arquivo');
  if (!(file instanceof File)) {
    return { ok: false, layer: 'arquivo', error: 'Nenhum arquivo foi enviado.' };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Autoritativo: lê a assinatura binária em vez de confiar no que o
  // navegador declarou como tipo.
  const check = validateBytes(bytes, file.type);
  if (!check.ok) {
    return { ok: false, layer: 'arquivo', error: check.error.message };
  }

  /* ------------------------------------------ 3. conteúdo (heurística) */

  let contentScore: number | null = null;
  let extractedText: string | undefined;

  if (check.mime === 'application/pdf') {
    const content = await checkPdfContent(bytes);
    contentScore = content.score;
    extractedText = content.text || undefined;

    // PDF escaneado não tem camada de texto: a heurística não se aplica e a
    // decisão fica com a IA (ou com o profissional).
    if (!content.looksClinical && !content.textUnavailable) {
      return {
        ok: false,
        layer: 'conteudo',
        error: `${content.reason} Envie o laudo do exame, em PDF ou foto legível.`,
      };
    }
  }

  /* ------------------------------------------------------- 4. upload */

  const ext = EXTENSIONS[check.mime];
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('documentos')
    .upload(path, bytes, { contentType: check.mime, upsert: false });

  if (uploadError) {
    return {
      ok: false,
      layer: 'arquivo',
      error: 'Não foi possível enviar o arquivo. Tente novamente.',
    };
  }

  const { data: doc, error: insertError } = await supabase
    .from('health_documents')
    .insert({
      patient_id: user.id,
      storage_path: path,
      original_name: file.name.slice(0, 200),
      mime_type: check.mime,
      size_bytes: bytes.length,
      page_count: check.pages,
      content_score: contentScore,
      consent_at: new Date().toISOString(),
      status: 'validando',
    })
    .select('id')
    .single();

  if (insertError || !doc) {
    // Não deixa arquivo órfão no bucket.
    await supabase.storage.from('documentos').remove([path]);
    return { ok: false, layer: 'arquivo', error: 'Não foi possível registrar o documento.' };
  }

  /* ------------------------------------------------ 5. triagem por IA */

  const analyzer = await getAnalyzer();

  // Sem provedor configurado, o documento fica na fila. Tudo que é
  // determinístico já foi verificado.
  if (!analyzer) {
    await supabase
      .from('health_documents')
      .update({ status: 'aguardando_analise' })
      .eq('id', doc.id);

    revalidatePath('/documentos');
    return {
      ok: true,
      documentId: doc.id,
      status: 'aguardando_analise',
      message:
        'Documento recebido e validado. A análise automática será feita assim que o serviço de IA estiver ativo.',
    };
  }

  const input: AnalyzerInput = {
    bytes,
    mime: check.mime,
    filename: file.name,
    text: extractedText,
  };

  try {
    const triage = await analyzer.triage(input);

    if (!triage.accepted) {
      // Documento alheio ao escopo: não fica guardado.
      await supabase.storage.from('documentos').remove([path]);
      await supabase
        .from('health_documents')
        .update({
          status: 'rejeitado',
          kind: triage.kind,
          reject_reason: triage.reason,
          provider: analyzer.provider,
        })
        .eq('id', doc.id);

      revalidatePath('/documentos');
      return { ok: false, layer: 'ia', error: triage.reason };
    }

    /* ---------------------------------------------- 6. extração */

    const analysis = await analyzer.analyze(input);

    await supabase
      .from('health_documents')
      .update({
        status: 'analisado',
        kind: triage.kind,
        provider: analyzer.provider,
        summary: analysis.summary,
        collected_on: analysis.collectedOn,
        lab: analysis.lab,
        markers: analysis.markers,
        highlights: analysis.highlights,
        analyzed_at: new Date().toISOString(),
      })
      .eq('id', doc.id);

    revalidatePath('/documentos');
    revalidatePath('/progresso');

    return {
      ok: true,
      documentId: doc.id,
      status: 'analisado',
      message: 'Documento analisado. Seu profissional foi notificado para revisar.',
    };
  } catch {
    // Falha do provedor não descarta o arquivo: o documento passou nas
    // checagens e pode ser reanalisado depois.
    await supabase
      .from('health_documents')
      .update({ status: 'erro', provider: analyzer.provider })
      .eq('id', doc.id);

    revalidatePath('/documentos');
    return {
      ok: false,
      layer: 'ia',
      error: 'O documento foi salvo, mas a análise falhou. Tente reanalisar em instantes.',
    };
  }
}

/* ------------------------------------------------------------- APAGAR --- */

export async function deleteHealthDocument(id: string): Promise<ActionResult> {
  const user = await requirePatient();
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from('health_documents')
    .select('storage_path')
    .eq('id', id)
    .eq('patient_id', user.id)
    .maybeSingle();

  if (!doc) return { ok: false, error: 'Documento não encontrado.' };

  await supabase.storage.from('documentos').remove([doc.storage_path]);

  const { error } = await supabase
    .from('health_documents')
    .delete()
    .eq('id', id)
    .eq('patient_id', user.id);

  if (error) return { ok: false, error: 'Não foi possível apagar o documento.' };

  revalidatePath('/documentos');
  return { ok: true };
}

/* ------------------------------------------------------------ BAIXAR ---- */

/**
 * URL temporária para o paciente reabrir o próprio documento.
 * O bucket é privado; o link expira em 60 segundos.
 */
export async function getDocumentUrl(id: string) {
  const user = await requirePatient();
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from('health_documents')
    .select('storage_path')
    .eq('id', id)
    .eq('patient_id', user.id)
    .maybeSingle();

  if (!doc) return { ok: false as const, error: 'Documento não encontrado.' };

  const { data, error } = await supabase.storage
    .from('documentos')
    .createSignedUrl(doc.storage_path, 60);

  if (error || !data) {
    return { ok: false as const, error: 'Não foi possível gerar o link.' };
  }

  return { ok: true as const, url: data.signedUrl };
}

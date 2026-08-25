'use client';

import { useRef, useState, useTransition } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  FileText,
  ImageIcon,
  Loader2,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { Badge, Button, Card, EmptyState, PageIntro, SectionTitle } from '@/components/ui';
import { Sheet } from '@/components/ui/interactive';
import {
  deleteHealthDocument,
  getDocumentUrl,
  uploadHealthDocument,
} from '@/lib/actions/documents';
import type { DocumentView } from '@/lib/queries/documents';
import {
  ACCEPT_ATTRIBUTE,
  humanSize,
  MAX_FILE_BYTES,
  MAX_PDF_PAGES,
  MAX_UPLOADS_PER_WEEK,
  validateBeforeUpload,
} from '@/lib/validation/document';
import { cn } from '@/lib/utils';

const STATUS_META = {
  validando: { label: 'Validando', tone: 'neutral' as const, icon: Loader2 },
  rejeitado: { label: 'Recusado', tone: 'danger' as const, icon: XCircle },
  aguardando_analise: { label: 'Na fila', tone: 'warn' as const, icon: Clock },
  analisado: { label: 'Analisado', tone: 'success' as const, icon: CheckCircle2 },
  erro: { label: 'Falhou', tone: 'danger' as const, icon: AlertCircle },
};

const KIND_LABEL: Record<string, string> = {
  exame_laboratorial: 'Exame laboratorial',
  laudo_imagem: 'Laudo de imagem',
  receita: 'Receita',
  atestado: 'Atestado',
  outro_saude: 'Documento de saúde',
  nao_relacionado: 'Não relacionado',
};

const MARKER_TONE = {
  ok: 'success' as const,
  atencao: 'warn' as const,
  alterado: 'danger' as const,
  indeterminado: 'neutral' as const,
};

export function DocumentosView({
  documents,
  usedThisWeek,
}: {
  documents: DocumentView[];
  usedThisWeek: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DocumentView | null>(null);
  const [pending, startTransition] = useTransition();

  const remaining = Math.max(0, MAX_UPLOADS_PER_WEEK - usedThisWeek);

  const pick = (picked: File | null) => {
    setError(null);
    setNotice(null);

    if (!picked) {
      setFile(null);
      return;
    }

    // Camada 1: retorno imediato, antes de gastar banda.
    const check = validateBeforeUpload(picked);
    if (!check.ok) {
      setError(check.error.message);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setFile(picked);
  };

  const send = () => {
    if (!file || !consent) return;
    setError(null);
    setNotice(null);

    startTransition(async () => {
      const data = new FormData();
      data.set('arquivo', file);
      data.set('consentimento', 'sim');

      const result = await uploadHealthDocument(data);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setNotice(result.message);
      setFile(null);
      setConsent(false);
      if (inputRef.current) inputRef.current.value = '';
    });
  };

  const open = (doc: DocumentView) => {
    startTransition(async () => {
      const result = await getDocumentUrl(doc.id);
      if (result.ok) window.open(result.url, '_blank', 'noopener,noreferrer');
      else setError(result.error);
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      await deleteHealthDocument(id);
      setDetail(null);
    });
  };

  return (
    <div className="space-y-6">
      <PageIntro
        title="Meus documentos"
        description="Envie seus exames para análise automática e revisão do seu profissional."
      />

      {/* ------------------------------------------------ envio */}
      <Card>
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
            <Upload className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Enviar exame</h2>
            <p className="text-sm text-muted">
              PDF ou foto legível · até {humanSize(MAX_FILE_BYTES)}
            </p>
          </div>
        </div>

        {/* Alvo de toque grande — no mobile o dedo precisa de área. */}
        <label
          className={cn(
            'tap mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors',
            file ? 'border-brand bg-brand-soft' : 'border-line hover:border-line-strong',
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />

          {file ? (
            <>
              <FileText className="mb-2 h-7 w-7 text-brand-text" aria-hidden />
              <span className="max-w-full truncate text-sm font-semibold">{file.name}</span>
              <span className="mt-1 text-sm text-muted">{humanSize(file.size)}</span>
              <span className="mt-2 text-sm font-semibold text-brand-text">
                Tocar para trocar
              </span>
            </>
          ) : (
            <>
              <Upload className="mb-2 h-7 w-7 text-subtle" aria-hidden />
              <span className="text-sm font-semibold">Escolher arquivo</span>
              <span className="mt-1 text-sm text-muted">PDF, JPG, PNG ou WebP</span>
            </>
          )}
        </label>

        {/* Consentimento explícito antes de mandar dado de saúde para fora. */}
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface-2 p-3.5">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-line-strong accent-[hsl(var(--brand))]"
          />
          <span className="text-sm text-muted">
            Autorizo o envio deste documento para análise automática. Os dados são
            processados apenas para gerar a leitura do exame e ficam visíveis para mim e
            para o meu profissional.
          </span>
        </label>

        {error && (
          <p
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-xl border border-danger/25 bg-danger-soft p-3 text-sm font-medium text-danger"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        {notice && (
          <p
            role="status"
            className="mt-3 flex items-start gap-2 rounded-xl border border-success/25 bg-success-soft p-3 text-sm font-medium text-success"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {notice}
          </p>
        )}

        <Button
          block
          size="lg"
          className="mt-4"
          onClick={send}
          disabled={!file || !consent || pending || remaining === 0}
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Verificando documento…
            </>
          ) : (
            'Enviar para análise'
          )}
        </Button>

        <p className="mt-2 text-center text-2xs text-subtle">
          {remaining > 0
            ? `${remaining} de ${MAX_UPLOADS_PER_WEEK} envios restantes nesta semana`
            : 'Limite semanal atingido. Renova na segunda-feira.'}
        </p>
      </Card>

      {/* ------------------------------------------------ o que é aceito */}
      <Card className="flex items-start gap-3 border-brand-line bg-brand-soft">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-text" aria-hidden />
        <div className="min-w-0 text-sm text-muted">
          <p className="font-semibold text-fg">O que pode ser enviado</p>
          <ul className="mt-1.5 space-y-1">
            <li>Resultados de exame de sangue, urina e hormônios</li>
            <li>Laudos de imagem: ultrassom, raio-x, densitometria</li>
            <li>Receitas e atestados do seu médico</li>
          </ul>
          <p className="mt-2.5">
            Documentos que não sejam de saúde são recusados automaticamente. PDFs com
            senha e arquivos acima de {MAX_PDF_PAGES} páginas também não passam.
          </p>
        </div>
      </Card>

      {/* ------------------------------------------------ enviados */}
      <section>
        <SectionTitle
          title="Enviados"
          hint={documents.length > 0 ? `${documents.length} documento(s)` : undefined}
        />

        {documents.length === 0 ? (
          <Card>
            <EmptyState
              icon={FileText}
              title="Nenhum documento ainda"
              description="Seus exames enviados aparecem aqui com o resultado da análise."
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => {
              const meta = STATUS_META[doc.status];
              const isOpen = openId === doc.id;
              const Icon = doc.mime === 'application/pdf' ? FileText : ImageIcon;

              return (
                <Card key={doc.id} inset className="overflow-hidden">
                  <button
                    onClick={() => setOpenId(isOpen ? null : doc.id)}
                    aria-expanded={isOpen}
                    className="tap flex w-full items-start gap-3 p-4 text-left"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{doc.name}</span>
                      <span className="mt-0.5 block text-sm text-muted">
                        {humanSize(doc.sizeBytes)}
                        {doc.pageCount ? ` · ${doc.pageCount} pág.` : ''} · {doc.sentAt}
                      </span>
                      <span className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge tone={meta.tone} icon={meta.icon}>
                          {meta.label}
                        </Badge>
                        {doc.kind && doc.status === 'analisado' && (
                          <Badge tone="neutral">{KIND_LABEL[doc.kind]}</Badge>
                        )}
                      </span>
                    </span>

                    <ChevronDown
                      className={cn(
                        'mt-1 h-5 w-5 shrink-0 text-subtle transition-transform',
                        isOpen && 'rotate-180',
                      )}
                      aria-hidden
                    />
                  </button>

                  {isOpen && (
                    <div className="animate-fade-in border-t border-line bg-surface-2/60 px-4 py-4">
                      {doc.status === 'rejeitado' && doc.rejectReason && (
                        <p className="mb-3 rounded-xl border border-danger/25 bg-danger-soft p-3 text-sm text-danger">
                          {doc.rejectReason}
                        </p>
                      )}

                      {doc.status === 'aguardando_analise' && (
                        <p className="mb-3 text-sm text-muted">
                          O documento passou nas verificações e está guardado. A leitura
                          automática acontece assim que o serviço de análise for ativado.
                        </p>
                      )}

                      {doc.summary && (
                        <p className="mb-3 text-sm leading-relaxed text-muted">
                          {doc.summary}
                        </p>
                      )}

                      {doc.highlights.length > 0 && (
                        <ul className="mb-3 space-y-1.5">
                          {doc.highlights.map((h) => (
                            <li key={h} className="flex items-start gap-2 text-sm">
                              <AlertCircle
                                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn"
                                aria-hidden
                              />
                              <span>{h}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="flex gap-2">
                        {doc.status !== 'rejeitado' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={ExternalLink}
                            onClick={() => open(doc)}
                            disabled={pending}
                          >
                            Abrir
                          </Button>
                        )}
                        {doc.markers.length > 0 && (
                          <Button variant="secondary" size="sm" onClick={() => setDetail(doc)}>
                            Ver {doc.markers.length} marcadores
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Trash2}
                          className="ml-auto text-danger"
                          onClick={() => remove(doc.id)}
                          disabled={pending}
                        >
                          Apagar
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ------------------------------------------------ marcadores */}
      <Sheet
        open={detail !== null}
        onClose={() => setDetail(null)}
        title="Marcadores extraídos"
        description={
          detail
            ? [detail.lab, detail.collectedOn].filter(Boolean).join(' · ') || detail.name
            : undefined
        }
      >
        <div className="pb-4">
          <p className="mb-4 rounded-xl border border-line bg-surface-2 p-3 text-sm text-muted">
            Valores transcritos automaticamente do documento. A leitura clínica é feita
            pelo seu profissional.
          </p>

          <ul className="divide-y divide-line">
            {detail?.markers.map((m, i) => (
              <li key={`${m.name}-${i}`} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{m.name}</p>
                  {m.referenceRange && (
                    <p className="mt-0.5 text-sm text-muted">Referência: {m.referenceRange}</p>
                  )}
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums">
                  {m.value}
                  {m.unit ? ` ${m.unit}` : ''}
                </span>
                <Badge tone={MARKER_TONE[m.status]} className="shrink-0">
                  {m.status === 'indeterminado' ? 'Sem faixa' : m.status}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      </Sheet>
    </div>
  );
}

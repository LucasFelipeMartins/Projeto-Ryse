'use client';

import { useState, useTransition } from 'react';
import {
  AlertCircle,
  Apple,
  Activity,
  BrainCircuit,
  Check,
  ClipboardCheck,
  Dumbbell,
  HeartPulse,
  Loader2,
  Save,
  Sparkles,
  TestTube,
  TrendingUp,
  Wand2,
  type LucideIcon,
} from 'lucide-react';
import { Badge, Button, Card, SectionTitle } from '@/components/ui';
import { Field, Input, Select, Textarea } from '@/components/ui/interactive';
import { ReportBody } from '@/components/features/ai-panels';
import { rodarAnaliseDoProtocolo } from '@/lib/actions/ai';
import { salvarProtocoloDeAnalise } from '@/lib/actions/ai-protocol';
import type { ContextScope } from '@/lib/ai/context';
import { AI_DISCLAIMER, type AiReport } from '@/lib/ai/schemas';
import type { AnalysisProtocolView } from '@/lib/queries/ai';
import type { AiDetailLevel, AiPriority } from '@/lib/supabase/types';
import { cn, relativeTime } from '@/lib/utils';

/**
 * Protocolo de análise da IA.
 *
 * É a pré-definição que orienta a inteligência sobre este paciente. O que o
 * profissional monta aqui não é sugestão: as áreas desmarcadas **não são
 * lidas** do banco quando a IA roda — a camada de contexto respeita o recorte
 * antes de qualquer chamada ao provedor.
 *
 * Isso muda o significado da tela. Não é uma preferência de exibição; é o
 * escopo do que sai do prontuário.
 */

const ESCOPOS: { value: ContextScope; label: string; hint: string; icon: LucideIcon }[] = [
  {
    value: 'saude',
    label: 'Saúde',
    hint: 'Histórico, restrições e indicadores gerais',
    icon: HeartPulse,
  },
  {
    value: 'exames',
    label: 'Exames',
    hint: 'Marcadores, faixas de referência e documentos',
    icon: TestTube,
  },
  {
    value: 'treino',
    label: 'Treino',
    hint: 'Plano ativo, sessões e esforço percebido',
    icon: Dumbbell,
  },
  {
    value: 'nutricao',
    label: 'Nutrição',
    hint: 'Plano alimentar e adesão às refeições',
    icon: Apple,
  },
  {
    value: 'evolucao',
    label: 'Evolução',
    hint: 'Peso, gordura, massa magra e cintura',
    icon: TrendingUp,
  },
  {
    value: 'checkins',
    label: 'Check-ins',
    hint: 'Sono, energia, fome, dor e adesão',
    icon: ClipboardCheck,
  },
];

const OBJETIVOS_SUGERIDOS = [
  'Emagrecimento',
  'Ganho de massa muscular',
  'Recomposição corporal',
  'Controle de exames alterados',
  'Performance esportiva',
  'Saúde e longevidade',
];

export function ProtocoloIA({
  patientId,
  patientName,
  initial,
  quotaUsed,
  quotaAvailableOn,
  aiEnabled,
}: {
  patientId: string;
  patientName: string;
  initial: AnalysisProtocolView | null;
  quotaUsed: boolean;
  quotaAvailableOn: string;
  aiEnabled: boolean;
}) {
  const [objective, setObjective] = useState(initial?.objective ?? '');
  const [priority, setPriority] = useState<AiPriority>(initial?.priority ?? 'media');
  const [detailLevel, setDetailLevel] = useState<AiDetailLevel>(
    initial?.detailLevel ?? 'completo',
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [scopes, setScopes] = useState<ContextScope[]>(
    initial?.scopes ?? ESCOPOS.map((e) => e.value),
  );

  const [savedAt, setSavedAt] = useState<string | null>(initial?.updatedAt ?? null);
  const [salvo, setSalvo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const [report, setReport] = useState<AiReport | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLimited, setAiLimited] = useState(false);
  const [running, startRunning] = useTransition();

  const toggleScope = (scope: ContextScope) => {
    setSalvo(false);
    setScopes((atual) =>
      atual.includes(scope) ? atual.filter((s) => s !== scope) : [...atual, scope],
    );
  };

  const salvar = () => {
    setError(null);
    setSalvo(false);

    startSaving(async () => {
      const result = await salvarProtocoloDeAnalise({
        patientId,
        objective,
        priority,
        scopes,
        detailLevel,
        notes,
      });

      if (!result.ok) {
        setError(result.error ?? 'Não foi possível salvar o protocolo.');
        return;
      }

      setSalvo(true);
      setSavedAt(new Date().toISOString());
    });
  };

  const rodar = () => {
    setAiError(null);
    setAiLimited(false);

    startRunning(async () => {
      const result = await rodarAnaliseDoProtocolo(patientId);

      if (!result.ok) {
        setAiError(result.error);
        setAiLimited(Boolean(result.limited));
        return;
      }

      setReport(result.data);
    });
  };

  const semProtocolo = !savedAt;

  return (
    <section>
      <SectionTitle
        title="Protocolo de análise da IA"
        hint="Define o que a inteligência considera ao avaliar este paciente."
        action={
          savedAt ? (
            <span className="text-sm text-muted">
              Atualizado {relativeTime(savedAt)}
            </span>
          ) : (
            <Badge tone="warn">Não configurado</Badge>
          )
        }
      />

      <Card>
        {semProtocolo && (
          <p className="mb-5 flex items-start gap-2 rounded-xl border border-line bg-surface-2 p-3 text-sm text-muted">
            <BrainCircuit className="mt-0.5 h-4 w-4 shrink-0 text-subtle" aria-hidden />
            Sem protocolo configurado, a IA analisa todas as áreas com detalhamento
            completo. Definir o recorte abaixo torna a análise mais precisa — e
            impede que dados fora do escopo saiam do prontuário.
          </p>
        )}

        {/* ------------------------------------------------ objetivo */}
        <Field label="Objetivo principal" hint="Norteia toda a análise.">
          <Input
            value={objective}
            onChange={(e) => {
              setObjective(e.target.value);
              setSalvo(false);
              setError(null);
            }}
            placeholder="Ex.: Emagrecimento com preservação de massa magra"
            maxLength={160}
          />
        </Field>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {OBJETIVOS_SUGERIDOS.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => {
                setObjective(o);
                setSalvo(false);
              }}
              className="tap rounded-full border border-line bg-surface px-2.5 py-1 text-2xs font-semibold text-muted transition-colors hover:border-line-strong hover:text-fg"
            >
              {o}
            </button>
          ))}
        </div>

        {/* ------------------------------------------------ prioridade e nível */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Prioridade" hint="Quanto o caso exige atenção próxima.">
            <Select
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value as AiPriority);
                setSalvo(false);
              }}
            >
              <option value="baixa">Baixa — acompanhamento de rotina</option>
              <option value="media">Média — evolução dentro do esperado</option>
              <option value="alta">Alta — requer atenção próxima</option>
            </Select>
          </Field>

          <Field label="Nível de detalhamento" hint="Quanto texto a IA produz.">
            <Select
              value={detailLevel}
              onChange={(e) => {
                setDetailLevel(e.target.value as AiDetailLevel);
                setSalvo(false);
              }}
            >
              <option value="resumido">Resumido — até 3 itens por bloco</option>
              <option value="padrao">Padrão — até 5 itens por bloco</option>
              <option value="completo">Completo — análise aprofundada</option>
            </Select>
          </Field>
        </div>

        {/* ------------------------------------------------ escopo */}
        <div className="mt-5">
          <p className="text-sm font-semibold">Analisar</p>
          <p className="mt-0.5 text-sm text-muted">
            Áreas desmarcadas não são lidas do banco quando a IA roda.
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {ESCOPOS.map((escopo) => {
              const ativo = scopes.includes(escopo.value);

              return (
                <button
                  key={escopo.value}
                  type="button"
                  role="checkbox"
                  aria-checked={ativo}
                  onClick={() => toggleScope(escopo.value)}
                  className={cn(
                    'tap flex items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                    ativo
                      ? 'border-brand bg-brand-soft'
                      : 'border-line bg-surface hover:border-line-strong',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
                      ativo
                        ? 'border-brand bg-brand text-brand-on'
                        : 'border-line-strong text-transparent',
                    )}
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <escopo.icon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          ativo ? 'text-brand-text' : 'text-subtle',
                        )}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          'text-sm font-semibold',
                          ativo && 'text-brand-text',
                        )}
                      >
                        {escopo.label}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-sm text-muted">{escopo.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {scopes.length === 0 && (
            <p className="mt-2 text-sm font-medium text-danger">
              Selecione ao menos uma área para a IA analisar.
            </p>
          )}
        </div>

        {/* ------------------------------------------------ observações */}
        <div className="mt-5">
          <Field
            label="Observações do profissional"
            hint="Contexto clínico que a IA deve levar em conta. Vai junto do prompt."
          >
            <Textarea
              rows={4}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setSalvo(false);
              }}
              maxLength={2000}
              placeholder="Ex.: paciente com histórico de lombalgia — evitar sugestões de agachamento livre. Priorizar leitura da tireoide nos exames."
            />
          </Field>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl border border-danger/25 bg-danger-soft p-3 text-sm font-medium text-danger"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        {/* ------------------------------------------------ ações */}
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <Button
            icon={saving ? undefined : Save}
            disabled={saving || scopes.length === 0}
            onClick={salvar}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Salvando…
              </>
            ) : savedAt ? (
              'Atualizar protocolo'
            ) : (
              'Salvar protocolo'
            )}
          </Button>

          {salvo && (
            <span
              role="status"
              className="flex items-center gap-1.5 text-sm font-medium text-success"
            >
              <Check className="h-4 w-4" aria-hidden />
              Protocolo salvo
            </span>
          )}
        </div>
      </Card>

      {/* ------------------------------------------------ execução */}
      <Card className="mt-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>

          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">
              Rodar análise de {patientName.split(' ')[0]}
            </h3>
            <p className="mt-1 text-sm text-muted">
              Cruza os dados do paciente, o protocolo configurado e o histórico
              disponível para produzir um parecer técnico.
            </p>

            {!aiEnabled ? (
              <p className="mt-3 rounded-xl border border-line bg-surface-2 p-3 text-sm text-muted">
                A análise por IA ainda não foi habilitada nesta instalação.
              </p>
            ) : (
              <>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button
                    icon={running ? undefined : Wand2}
                    disabled={running || (quotaUsed && !report) || semProtocolo}
                    onClick={rodar}
                    className="w-full sm:w-auto"
                  >
                    {running ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Analisando…
                      </>
                    ) : report ? (
                      'Analisar de novo'
                    ) : (
                      'Rodar análise da IA'
                    )}
                  </Button>

                  <p className="flex items-center gap-1.5 text-sm text-muted">
                    <Activity className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {quotaUsed ? (
                      <>
                        Limite semanal usado. Disponível em{' '}
                        <strong className="text-fg">{quotaAvailableOn}</strong>.
                      </>
                    ) : (
                      <>1 análise por semana · disponível agora</>
                    )}
                  </p>
                </div>

                {semProtocolo && (
                  <p className="mt-3 text-sm text-warn">
                    Salve o protocolo antes de rodar — é ele que define o recorte
                    da análise.
                  </p>
                )}

                {running && (
                  <p
                    role="status"
                    className="mt-3 flex items-center gap-2 rounded-xl border border-brand-line bg-brand-soft p-3 text-sm text-brand-text"
                  >
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    Lendo o prontuário e montando o parecer. Costuma levar de 10 a 30
                    segundos.
                  </p>
                )}

                {aiError && (
                  <p
                    role="alert"
                    className={cn(
                      'mt-3 flex items-start gap-2 rounded-xl border p-3 text-sm',
                      aiLimited
                        ? 'border-warn/25 bg-warn-soft text-warn'
                        : 'border-danger/25 bg-danger-soft text-danger',
                    )}
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    {aiError}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {report && (
          <div className="mt-5 border-t border-line pt-5">
            <ReportBody report={report} />

            <p className="mt-5 rounded-xl border border-line bg-surface-2 p-3 text-sm text-muted">
              {AI_DISCLAIMER}
            </p>
          </div>
        )}
      </Card>
    </section>
  );
}

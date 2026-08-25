'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  ArrowDown,
  ArrowRight,
  BrainCircuit,
  Check,
  ChevronLeft,
  Clock,
  FileText,
  Loader2,
  MessageSquare,
  Minus,
  Pencil,
  Plus,
  Target,
  X,
} from 'lucide-react';
import { AiPanel, Avatar, Badge, Button, ButtonLink, Card, SectionTitle } from '@/components/ui';
import { Sheet, Textarea } from '@/components/ui/interactive';
import { decideReview } from '@/lib/actions/pro';
import type { ReviewView } from '@/lib/queries/pro';

type Decision = 'aprovar' | 'editar' | 'rejeitar';

const decisionCopy: Record<Decision, { title: string; description: string; cta: string }> = {
  aprovar: {
    title: 'Aprovar e liberar',
    description: 'O paciente recebe o novo protocolo imediatamente e é notificado.',
    cta: 'Confirmar aprovação',
  },
  editar: {
    title: 'Editar antes de liberar',
    description: 'Ajuste a proposta da IA e libere sua versão para o paciente.',
    cta: 'Salvar e liberar',
  },
  rejeitar: {
    title: 'Rejeitar proposta',
    description:
      'O protocolo atual é mantido. Seu motivo alimenta o modelo e reduz sugestões parecidas.',
    cta: 'Confirmar rejeição',
  },
};

export function RevisaoDetalhe({ item }: { item: ReviewView }) {
  const router = useRouter();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [done, setDone] = useState<Decision | null>(null);
  const [note, setNote] = useState('');

  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const confirm = () => {
    if (!decision) return;
    setError(null);

    startSaving(async () => {
      const result = await decideReview(item.id, decision, note);
      if (!result.ok) {
        setError(result.error ?? 'Não foi possível registrar.');
        return;
      }
      setDone(decision);
      setDecision(null);
    });
  };

  return (
    <div className="space-y-5 pb-4">
      {/* ------------------------------------------------ contexto */}
      <Card>
        <div className="flex items-start gap-3">
          <button
            onClick={() => router.push('/pro/revisao')}
            aria-label="Voltar para a fila"
            className="tap hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line text-muted hover:text-fg lg:flex"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>

          <Avatar name={item.patient} size="md" />

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold tracking-tight">{item.patient}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span className="flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" aria-hidden />
                {item.module}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {item.age}
              </span>
            </div>
          </div>

          <Badge tone={item.urgency === 'alta' ? 'danger' : 'warn'} className="shrink-0">
            {item.urgency === 'alta' ? 'Prioridade' : 'Revisão'}
          </Badge>
        </div>

        <div className="mt-4 flex gap-2 border-t border-line pt-4">
          <ButtonLink
            href={`/pro/pacientes/${item.patientId}`}
            variant="secondary"
            size="sm"
            icon={FileText}
            className="flex-1 sm:flex-none"
          >
            Prontuário
          </ButtonLink>
          <ButtonLink
            href="/pro/mensagens"
            variant="secondary"
            size="sm"
            icon={MessageSquare}
            className="flex-1 sm:flex-none"
          >
            Mensagem
          </ButtonLink>
        </div>
      </Card>

      {done && (
        <Card
          className={
            done === 'rejeitar'
              ? 'border-danger/30 bg-danger-soft'
              : 'border-success/30 bg-success-soft'
          }
        >
          <div className="flex items-center gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white ${
                done === 'rejeitar' ? 'bg-danger' : 'bg-success'
              }`}
            >
              {done === 'rejeitar' ? (
                <X className="h-5 w-5" strokeWidth={3} aria-hidden />
              ) : (
                <Check className="h-5 w-5" strokeWidth={3} aria-hidden />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">
                {done === 'rejeitar' ? 'Proposta rejeitada' : 'Protocolo liberado'}
              </p>
              <p className="mt-0.5 text-sm text-muted">
                {done === 'rejeitar'
                  ? 'O protocolo atual foi mantido e o paciente não foi notificado.'
                  : `${item.patient} já pode ver a alteração no app.`}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => router.push('/pro/revisao')}>
              Próximo
            </Button>
          </div>
        </Card>
      )}

      {/* ------------------------------------------------ parecer da IA */}
      <AiPanel>
        <div className="flex items-start justify-between gap-4">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <BrainCircuit className="h-4 w-4 text-brand" aria-hidden />
            Parecer da IA
          </h2>
          <div className="text-right">
            <p className="text-2xl font-bold leading-none tabular-nums">
              {item.confidence}%
            </p>
            <p className="mt-1 text-2xs font-semibold uppercase tracking-wider text-ink-on/50">
              Confiança
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <div className="rounded-xl bg-ink-on/[0.07] p-3.5">
            <p className="text-2xs font-bold uppercase tracking-wider text-ink-on/50">
              Gatilho — por que alterar
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-on/85">{item.rationale}</p>
          </div>

          <div className="rounded-xl bg-ink-on/[0.07] p-3.5">
            <p className="text-2xs font-bold uppercase tracking-wider text-brand">
              Ação proposta
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-on/85">{item.action}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {item.sources.map((s) => (
            <span
              key={s}
              className="rounded-full border border-ink-on/15 bg-ink-on/[0.07] px-2.5 py-1 text-2xs font-semibold text-ink-on/70"
            >
              {s}
            </span>
          ))}
        </div>
      </AiPanel>

      {/* ------------------------------------------------ diff visual */}
      <section>
        <SectionTitle
          title="O que muda no protocolo"
          hint={`Módulo: ${item.module}`}
        />

        {/* Mobile: antes em cima, depois embaixo. Desktop: lado a lado. */}
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch lg:gap-4">
          <Card className="relative border-danger/25">
            <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-lg bg-danger-soft text-danger">
              <Minus className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
            </span>
            <p className="text-2xs font-bold uppercase tracking-wider text-subtle">
              {item.before.title}
            </p>
            <ul className="mt-3 space-y-1.5">
              {item.before.lines.map((l) => (
                <li key={l} className="text-sm text-muted">
                  {l}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
              {item.before.kcal > 0 && (
                <span className="font-bold tabular-nums">{item.before.kcal} kcal</span>
              )}
              <span className="ml-auto tabular-nums text-muted">{item.before.macros}</span>
            </div>
          </Card>

          <div className="flex items-center justify-center lg:px-1">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface-2 text-subtle">
              <ArrowDown className="h-4 w-4 lg:hidden" aria-hidden />
              <ArrowRight className="hidden h-4 w-4 lg:block" aria-hidden />
            </span>
          </div>

          <Card className="relative border-success/40 ring-1 ring-success/15">
            <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-lg bg-success-soft text-success">
              <Plus className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
            </span>
            <p className="text-2xs font-bold uppercase tracking-wider text-brand-text">
              {item.after.title}
            </p>
            <ul className="mt-3 space-y-1.5">
              {item.after.lines.map((l, i) => {
                const isNew = !item.before.lines.includes(l);
                return (
                  <li
                    key={`${l}-${i}`}
                    className={isNew ? 'text-sm font-semibold text-fg' : 'text-sm text-muted'}
                  >
                    {isNew && (
                      <span className="mr-1.5 text-success" aria-label="novo item">
                        +
                      </span>
                    )}
                    {l}
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
              {item.after.kcal > 0 && (
                <span className="font-bold tabular-nums text-success">
                  {item.after.kcal} kcal
                </span>
              )}
              <span className="ml-auto tabular-nums text-muted">{item.after.macros}</span>
            </div>
          </Card>
        </div>
      </section>

      {/* ------------------------------------------------ decisão */}
      <Card className="border-line-strong">
        <h2 className="text-sm font-bold">Decisão clínica</h2>
        <p className="mt-1 text-sm text-muted">
          Sua escolha é registrada no prontuário com data, hora e CRM.
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Button icon={Check} onClick={() => setDecision('aprovar')} disabled={done !== null}>
            Aprovar
          </Button>
          <Button
            variant="secondary"
            icon={Pencil}
            onClick={() => setDecision('editar')}
            disabled={done !== null}
          >
            Editar
          </Button>
          <Button
            variant="secondary"
            icon={X}
            className="text-danger"
            onClick={() => setDecision('rejeitar')}
            disabled={done !== null}
          >
            Rejeitar
          </Button>
        </div>
      </Card>

      {/* ------------------------------------------------ confirmação */}
      <Sheet
        open={decision !== null}
        onClose={() => setDecision(null)}
        title={decision ? decisionCopy[decision].title : ''}
        description={decision ? decisionCopy[decision].description : undefined}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setDecision(null)}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              variant={decision === 'rejeitar' ? 'danger' : 'primary'}
              onClick={confirm}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Registrando…
                </>
              ) : (
                (decision && decisionCopy[decision].cta) || ''
              )}
            </Button>
          </div>
        }
      >
        <div className="pb-4">
          {error && (
            <p role="alert" className="mb-3 rounded-xl border border-danger/25 bg-danger-soft p-3 text-sm font-medium text-danger">
              {error}
            </p>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">
              {decision === 'rejeitar' ? 'Motivo da rejeição' : 'Observação clínica'}
              {decision !== 'rejeitar' && (
                <span className="ml-1 font-normal text-subtle">(opcional)</span>
              )}
            </span>
            <Textarea
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                decision === 'rejeitar'
                  ? 'Ex.: paciente com restrição não registrada no sistema.'
                  : 'Ex.: revisar ferritina em 60 dias.'
              }
            />
          </label>

          {decision === 'rejeitar' && (
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                'Contraindicação clínica',
                'Dado desatualizado',
                'Preferência do paciente',
                'Prefiro ajuste manual',
              ].map((r) => (
                <button
                  key={r}
                  onClick={() => setNote(r)}
                  className="tap rounded-full border border-line px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-brand hover:text-fg"
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
      </Sheet>
    </div>
  );
}

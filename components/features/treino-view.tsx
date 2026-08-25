'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Activity,
  CalendarDays,
  ChevronRight,
  Clock,
  Dumbbell,
  Info,
  Play,
  Repeat,
  Weight,
} from 'lucide-react';
import { Badge, ButtonLink, Card, EmptyState, PageIntro, SectionTitle } from '@/components/ui';
import { Sheet } from '@/components/ui/interactive';
import type { ExerciseView, WeekDayView, WorkoutView } from '@/lib/queries/patient';
import { cn } from '@/lib/utils';

const stateStyles = {
  done: 'border-success/30 bg-success-soft text-success',
  today: 'border-brand bg-brand text-brand-on shadow-brand',
  next: 'border-line bg-surface text-muted',
  rest: 'border-dashed border-line bg-surface-2 text-subtle',
} as const;

export function TreinoView({
  plan,
  today,
  week,
}: {
  plan: { title: string; split: string | null; week_number: number; total_weeks: number } | null;
  today: WorkoutView | null;
  week: WeekDayView[];
}) {
  const [detail, setDetail] = useState<ExerciseView | null>(null);

  if (!plan || !today) {
    return (
      <div className="space-y-6">
        <PageIntro title="Treino" />
        <Card>
          <EmptyState
            icon={Dumbbell}
            title="Nenhuma ficha ativa"
            description="Quando seu profissional montar a periodização, as fichas da semana aparecem aqui."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow={`${plan.split ?? 'Periodização'} · semana ${plan.week_number} de ${plan.total_weeks}`}
        title="Treino"
        description={plan.title}
      />

      {/* ------------------------------------------------ divisão semanal */}
      <section>
        <SectionTitle title="Sua semana" />
        <div className="snap-x-chips -mx-4 px-4 sm:mx-0 sm:grid sm:grid-cols-7 sm:gap-2 sm:overflow-visible sm:px-0">
          {week.map((d, i) => (
            <div
              key={`${d.day}-${i}`}
              className={cn(
                'w-[76px] shrink-0 snap-start rounded-2xl border px-2 py-3 text-center sm:w-auto',
                stateStyles[d.state],
              )}
            >
              <span className="block text-2xs font-bold uppercase tracking-wider opacity-70">
                {d.day}
              </span>
              <span className="mt-1.5 block text-lg font-bold leading-none">{d.letter}</span>
              <span className="mt-1.5 block truncate text-2xs font-medium opacity-80">
                {d.focus}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ treino de hoje */}
      <Card className="relative overflow-hidden">
        <span className="absolute inset-x-0 top-0 h-1 bg-brand" aria-hidden />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-xl font-bold text-brand-on">
              {today.letter}
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight">{today.title}</h2>
              <p className="text-sm text-muted">{today.focus}</p>
            </div>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-2">
          {[
            { icon: Clock, label: 'Duração', value: `${today.minutes} min` },
            {
              icon: Activity,
              label: 'Séries',
              value: String(today.exercises.reduce((s, e) => s + e.sets, 0)),
            },
            { icon: Dumbbell, label: 'Exercícios', value: String(today.exercises.length) },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-surface-2 px-3 py-2.5">
              <dt className="flex items-center gap-1.5 text-2xs font-medium text-subtle">
                <s.icon className="h-3 w-3" aria-hidden />
                {s.label}
              </dt>
              <dd className="mt-1 text-sm font-bold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>

        <ButtonLink href="/treino/sessao" icon={Play} block size="lg" className="mt-5">
          Iniciar treino
        </ButtonLink>
      </Card>

      {/* ------------------------------------------------ exercícios */}
      <section>
        <SectionTitle
          title="Exercícios"
          action={
            <Link href="/treino/sessao" className="text-sm font-semibold text-brand-text hover:underline">
              Registrar cargas
            </Link>
          }
        />

        <Card inset className="divide-y divide-line overflow-hidden">
          {today.exercises.map((ex, i) => (
            <button
              key={ex.id}
              onClick={() => setDetail(ex)}
              className="tap flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-sm font-bold tabular-nums text-muted">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{ex.name}</span>
                <span className="mt-0.5 block text-sm text-muted">
                  {ex.sets} × {ex.reps} · {ex.load}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
            </button>
          ))}
        </Card>
      </section>

      <Card className="flex items-start gap-3">
        <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
        <p className="text-sm text-muted">
          Faltam{' '}
          <strong className="text-fg">{plan.total_weeks - plan.week_number} semanas</strong>{' '}
          para a revisão de ciclo. A IA compara suas cargas registradas com a meta da
          periodização.
        </p>
      </Card>

      {/* ------------------------------------------------ folha do exercício */}
      <Sheet
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.name ?? ''}
        description={detail?.muscle}
      >
        {detail && (
          <div className="pb-4">
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { icon: Repeat, label: 'Séries', value: String(detail.sets) },
                { icon: Activity, label: 'Repetições', value: detail.reps },
                { icon: Weight, label: 'Carga', value: detail.load },
                { icon: Clock, label: 'Descanso', value: detail.rest },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-line px-3 py-2.5">
                  <dt className="flex items-center gap-1.5 text-2xs font-medium text-subtle">
                    <s.icon className="h-3 w-3" aria-hidden />
                    {s.label}
                  </dt>
                  <dd className="mt-1 text-sm font-bold tabular-nums">{s.value}</dd>
                </div>
              ))}
            </dl>

            {detail.note && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-brand-line bg-brand-soft p-3.5">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-text" aria-hidden />
                <p className="text-sm text-muted">{detail.note}</p>
              </div>
            )}

            <Badge tone="neutral" className="mt-5">
              O histórico de carga aparece depois da primeira sessão registrada.
            </Badge>
          </div>
        )}
      </Sheet>
    </div>
  );
}

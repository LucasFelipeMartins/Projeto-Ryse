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
import { Badge, ButtonLink, Card, PageIntro, SectionTitle } from '@/components/ui';
import { Sheet } from '@/components/ui/interactive';
import { weekSplit, workoutToday, type Exercise } from '@/lib/data';
import { cn } from '@/lib/utils';

const stateStyles = {
  done: 'border-success/30 bg-success-soft text-success',
  today: 'border-brand bg-brand text-brand-on shadow-brand',
  next: 'border-line bg-surface text-muted',
  rest: 'border-dashed border-line bg-surface-2 text-subtle',
} as const;

export function TreinoView() {
  const [detail, setDetail] = useState<Exercise | null>(null);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Ficha C · Semana 9"
        title="Treino"
        description="Periodização ondulatória, ajustada pela IA e aprovada pelo seu médico."
      />

      {/* ------------------------------------------------ divisão semanal */}
      <section>
        <SectionTitle title="Sua semana" hint="Toque no dia para ver a ficha." />
        {/* Rolagem horizontal no mobile; grade completa a partir do sm. */}
        <div className="snap-x-chips -mx-4 px-4 sm:mx-0 sm:grid sm:grid-cols-7 sm:gap-2 sm:overflow-visible sm:px-0">
          {weekSplit.map((d, i) => (
            <button
              key={`${d.day}-${i}`}
              className={cn(
                'tap w-[76px] shrink-0 snap-start rounded-2xl border px-2 py-3 text-center transition-colors sm:w-auto',
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
            </button>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ treino de hoje */}
      <Card className="relative overflow-hidden">
        <span className="absolute inset-x-0 top-0 h-1 bg-brand" aria-hidden />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-xl font-bold text-brand-on">
              {workoutToday.letter}
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight">{workoutToday.title}</h2>
              <p className="text-sm text-muted">{workoutToday.focus}</p>
            </div>
          </div>
          <Badge tone="warn">Não iniciado</Badge>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-2">
          {[
            { icon: Clock, label: 'Duração', value: `${workoutToday.duration} min` },
            { icon: Activity, label: 'Volume', value: workoutToday.volume },
            {
              icon: Dumbbell,
              label: 'Exercícios',
              value: String(workoutToday.exercises.length),
            },
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
            <Link
              href="/treino/sessao"
              className="text-sm font-semibold text-brand-text hover:underline"
            >
              Registrar cargas
            </Link>
          }
        />

        <Card inset className="divide-y divide-line overflow-hidden">
          {workoutToday.exercises.map((ex, i) => (
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
              {ex.done && <Badge tone="success">Feito</Badge>}
              <ChevronRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
            </button>
          ))}
        </Card>
      </section>

      <Card className="flex items-start gap-3">
        <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
        <p className="text-sm text-muted">
          Próxima revisão de ciclo em <strong className="text-fg">12 dias</strong>. A IA
          vai comparar suas cargas registradas com a meta da periodização.
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

            <h3 className="mb-2 mt-6 text-sm font-semibold">Histórico de carga</h3>
            <ul className="space-y-2">
              {[
                { week: 'Semana 9 (hoje)', load: detail.load, note: 'Meta' },
                { week: 'Semana 8', load: '75 kg', note: '4 × 8 concluídas' },
                { week: 'Semana 7', load: '75 kg', note: '4 × 7 concluídas' },
              ].map((h) => (
                <li
                  key={h.week}
                  className="flex items-center justify-between rounded-xl bg-surface-2 px-3.5 py-2.5"
                >
                  <span className="text-sm font-medium">{h.week}</span>
                  <span className="text-sm text-muted">
                    <strong className="tabular-nums text-fg">{h.load}</strong> · {h.note}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Sheet>
    </div>
  );
}

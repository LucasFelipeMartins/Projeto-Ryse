'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Check, ChevronLeft, Pause, Play, RotateCcw, Timer, Trophy } from 'lucide-react';
import { Badge, Button, Card, Progress } from '@/components/ui';
import { Sheet } from '@/components/ui/interactive';
import { workoutToday } from '@/lib/data';
import { cn } from '@/lib/utils';

type SetLog = { done: boolean; load: string; reps: string };

const buildLogs = () =>
  workoutToday.exercises.map((ex) =>
    Array.from({ length: ex.sets }, () => ({
      done: false,
      load: ex.load.replace(' kg', ''),
      reps: ex.reps.split('-')[0],
    })),
  );

export function SessaoView() {
  const router = useRouter();
  const [logs, setLogs] = useState<SetLog[][]>(buildLogs);
  const [current, setCurrent] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(true);
  const [finished, setFinished] = useState(false);

  // Cronômetro da sessão.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const exercise = workoutToday.exercises[current];
  const totalSets = logs.flat().length;
  const doneSets = logs.flat().filter((s) => s.done).length;
  const progress = (doneSets / totalSets) * 100;

  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(
    seconds % 60,
  ).padStart(2, '0')}`;

  const update = (setIdx: number, patch: Partial<SetLog>) =>
    setLogs((prev) =>
      prev.map((sets, i) =>
        i === current ? sets.map((s, j) => (j === setIdx ? { ...s, ...patch } : s)) : sets,
      ),
    );

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------ cabeçalho fixo */}
      <Card className="sticky top-[calc(theme(spacing.header)+env(safe-area-inset-top))] z-30 border-line-strong">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/treino')}
            aria-label="Sair da sessão"
            className="tap -ml-1 flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-2xs font-bold uppercase tracking-wider text-subtle">
              Ficha {workoutToday.letter} · {workoutToday.focus}
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">
              {doneSets} de {totalSets} séries
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
            <Timer className="h-4 w-4 text-brand" aria-hidden />
            <span className="text-base font-bold tabular-nums">{clock}</span>
          </div>

          <button
            onClick={() => setRunning((r) => !r)}
            aria-label={running ? 'Pausar cronômetro' : 'Retomar cronômetro'}
            className="tap flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-brand-on"
          >
            {running ? (
              <Pause className="h-4 w-4" aria-hidden />
            ) : (
              <Play className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>

        <Progress value={progress} className="mt-3" label="Progresso da sessão" />
      </Card>

      {/* ------------------------------------------------ seletor de exercício */}
      <div className="snap-x-chips -mx-4 px-4 sm:mx-0 sm:px-0">
        {workoutToday.exercises.map((ex, i) => {
          const allDone = logs[i].every((s) => s.done);
          return (
            <button
              key={ex.id}
              onClick={() => setCurrent(i)}
              className={cn(
                'tap flex shrink-0 snap-start items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors',
                i === current
                  ? 'border-brand bg-brand text-brand-on'
                  : allDone
                    ? 'border-success/30 bg-success-soft text-success'
                    : 'border-line bg-surface text-muted',
              )}
            >
              {allDone && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
              {i + 1}. {ex.name}
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------ séries */}
      <Card>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight">{exercise.name}</h2>
            <p className="text-sm text-muted">
              {exercise.muscle} · alvo {exercise.reps} reps · descanso {exercise.rest}
            </p>
          </div>
          <Badge tone="neutral">{exercise.sets} séries</Badge>
        </div>

        {/* Cabeçalho da grade de séries */}
        <div className="grid grid-cols-[2.5rem_1fr_1fr_2.75rem] gap-2 px-1 pb-2">
          {['Série', 'Carga (kg)', 'Reps', ''].map((h) => (
            <span key={h} className="text-2xs font-bold uppercase tracking-wider text-subtle">
              {h}
            </span>
          ))}
        </div>

        <div className="space-y-2">
          {logs[current].map((set, i) => (
            <div
              key={i}
              className={cn(
                'grid grid-cols-[2.5rem_1fr_1fr_2.75rem] items-center gap-2 rounded-xl border p-2 transition-colors',
                set.done ? 'border-success/30 bg-success-soft' : 'border-line bg-surface',
              )}
            >
              <span className="text-center text-sm font-bold tabular-nums text-muted">
                {i + 1}
              </span>

              <input
                inputMode="decimal"
                value={set.load}
                onChange={(e) => update(i, { load: e.target.value })}
                aria-label={`Carga da série ${i + 1}`}
                className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-center text-base font-semibold tabular-nums focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              />

              <input
                inputMode="numeric"
                value={set.reps}
                onChange={(e) => update(i, { reps: e.target.value })}
                aria-label={`Repetições da série ${i + 1}`}
                className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-center text-base font-semibold tabular-nums focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              />

              <button
                onClick={() => update(i, { done: !set.done })}
                aria-label={`Concluir série ${i + 1}`}
                aria-pressed={set.done}
                className={cn(
                  'tap flex h-11 w-11 items-center justify-center rounded-lg border-2 transition-colors',
                  set.done
                    ? 'border-success bg-success text-white'
                    : 'border-line-strong text-subtle hover:border-brand hover:text-brand',
                )}
              >
                <Check className="h-5 w-5" strokeWidth={3} aria-hidden />
              </button>
            </div>
          ))}
        </div>

        {exercise.note && (
          <p className="mt-4 rounded-xl border border-brand-line bg-brand-soft p-3.5 text-sm text-muted">
            {exercise.note}
          </p>
        )}
      </Card>

      {/* ------------------------------------------------ ações */}
      <div className="flex gap-3">
        <Button
          variant="secondary"
          icon={RotateCcw}
          className="flex-1"
          onClick={() => {
            setLogs(buildLogs());
            setSeconds(0);
          }}
        >
          Reiniciar
        </Button>
        <Button className="flex-1" onClick={() => setFinished(true)}>
          Finalizar treino
        </Button>
      </div>

      <Sheet
        open={finished}
        onClose={() => setFinished(false)}
        title="Treino concluído"
        description="Os dados vão para a análise da IA e para o painel do seu médico."
        footer={
          <Button block onClick={() => router.push('/inicio')}>
            Voltar para o início
          </Button>
        }
      >
        <div className="pb-4">
          <div className="mb-5 flex flex-col items-center py-4">
            <span className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-brand-on">
              <Trophy className="h-7 w-7" aria-hidden />
            </span>
            <p className="text-3xl font-bold tabular-nums">{clock}</p>
            <p className="text-sm text-muted">tempo total de sessão</p>
          </div>

          <dl className="grid grid-cols-3 gap-2">
            {[
              { label: 'Séries', value: `${doneSets}/${totalSets}` },
              { label: 'Exercícios', value: String(workoutToday.exercises.length) },
              { label: 'Ficha', value: workoutToday.letter },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-surface-2 px-3 py-3 text-center">
                <dt className="text-2xs font-medium text-subtle">{s.label}</dt>
                <dd className="mt-1 text-base font-bold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Sheet>
    </div>
  );
}

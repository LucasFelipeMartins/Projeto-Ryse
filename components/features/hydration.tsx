'use client';

import { useOptimistic, useRef, useState, useTransition } from 'react';
import { Check, Droplet, Loader2, Plus, Settings2, Undo2 } from 'lucide-react';
import { Button, Card, Progress } from '@/components/ui';
import { Sheet } from '@/components/ui/interactive';
import { logHydration, removeHydration, updateWaterGoal } from '@/lib/actions/patient';
import { MAX_INTAKE_ML } from '@/lib/types';
import type { HydrationView } from '@/lib/queries/patient';
import { litros } from '@/lib/utils';

/**
 * Registro de hidratação em mililitros.
 *
 * O paciente digita o volume exato que bebeu — não há botão de incremento
 * fixo, porque copo, garrafa e squeeze têm capacidades diferentes.
 */
export function HydrationCard({ data }: { data: HydrationView }) {
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Enquanto o servidor confirma, a barra já mostra o total novo.
  const [optimisticTotal, addOptimistic] = useOptimistic(
    data.totalMl,
    (total: number, delta: number) => Math.max(0, total + delta),
  );

  const pct = data.goalMl > 0 ? Math.min(100, (optimisticTotal / data.goalMl) * 100) : 0;
  const remaining = Math.max(0, data.goalMl - optimisticTotal);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const ml = Number(amount.replace(',', '.'));

    if (!amount.trim() || !Number.isFinite(ml) || ml <= 0) {
      setError('Digite quantos ml você bebeu.');
      inputRef.current?.focus();
      return;
    }
    if (ml > MAX_INTAKE_ML) {
      setError(`Registre no máximo ${MAX_INTAKE_ML.toLocaleString('pt-BR')} ml por vez.`);
      return;
    }

    startTransition(async () => {
      addOptimistic(Math.round(ml));
      const result = await logHydration(ml);
      if (!result.ok) {
        setError(result.error ?? 'Não foi possível registrar.');
        return;
      }
      setAmount('');
    });
  };

  const undo = (id: string, ml: number) => {
    startTransition(async () => {
      addOptimistic(-ml);
      await removeHydration(id);
    });
  };

  return (
    <Card>
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
          <Droplet className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Hidratação</h3>
          <p className="text-sm text-muted">
            <span className="font-bold tabular-nums text-fg">
              {optimisticTotal.toLocaleString('pt-BR')} ml
            </span>{' '}
            de {data.goalMl.toLocaleString('pt-BR')} ml
          </p>
        </div>
        <button
          onClick={() => setGoalOpen(true)}
          aria-label="Ajustar meta diária"
          className="tap flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-subtle hover:text-fg"
        >
          <Settings2 className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <Progress
        value={pct}
        className="mt-4"
        label={`Hidratação: ${Math.round(pct)}% da meta`}
      />

      <p className="mt-2 text-sm text-muted">
        {remaining > 0 ? (
          <>
            Faltam{' '}
            <strong className="tabular-nums text-fg">
              {remaining.toLocaleString('pt-BR')} ml
            </strong>{' '}
            para a meta ({litros(data.goalMl)}).
          </>
        ) : (
          <span className="font-semibold text-success">Meta do dia batida.</span>
        )}
      </p>

      {/* ------------------------------------------------ registro em ml */}
      <form onSubmit={submit} className="mt-4">
        <label htmlFor="hidratacao-ml" className="mb-1.5 block text-sm font-semibold">
          Quanto você bebeu?
        </label>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              id="hidratacao-ml"
              ref={inputRef}
              // inputMode numeric abre o teclado de números no celular.
              inputMode="numeric"
              pattern="[0-9]*"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value.replace(/[^\d]/g, ''));
                setError(null);
              }}
              placeholder="Ex.: 350"
              aria-describedby={error ? 'hidratacao-erro' : undefined}
              aria-invalid={error ? true : undefined}
              className="h-12 w-full rounded-xl border border-line bg-surface pl-3.5 pr-12 text-base font-semibold tabular-nums placeholder:font-normal placeholder:text-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            <span
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-subtle"
              aria-hidden
            >
              ml
            </span>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="tap flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-on shadow-brand disabled:opacity-60"
            aria-label="Registrar hidratação"
          >
            {pending ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <Plus className="h-5 w-5" aria-hidden />
            )}
          </button>
        </div>

        {error && (
          <p id="hidratacao-erro" role="alert" className="mt-2 text-sm font-medium text-danger">
            {error}
          </p>
        )}
      </form>

      {/* ------------------------------------------------ registros de hoje */}
      {data.entries.length > 0 && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2 text-2xs font-bold uppercase tracking-wider text-subtle">
            Hoje ({data.entries.length}{' '}
            {data.entries.length === 1 ? 'registro' : 'registros'})
          </p>
          <ul className="flex flex-wrap gap-2">
            {data.entries.slice(0, 8).map((entry) => (
              <li key={entry.id}>
                <button
                  onClick={() => undo(entry.id, entry.amountMl)}
                  disabled={pending}
                  className="tap group flex items-center gap-1.5 rounded-full border border-line bg-surface-2 py-1.5 pl-3 pr-2 text-sm font-semibold tabular-nums transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-50"
                  title="Remover este registro"
                >
                  {entry.amountMl.toLocaleString('pt-BR')} ml
                  <Undo2 className="h-3.5 w-3.5 text-subtle group-hover:text-danger" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <GoalSheet
        open={goalOpen}
        onClose={() => setGoalOpen(false)}
        currentGoal={data.goalMl}
      />
    </Card>
  );
}

/* ----------------------------------------------------------- META DIÁRIA */

function GoalSheet({
  open,
  onClose,
  currentGoal,
}: {
  open: boolean;
  onClose: () => void;
  currentGoal: number;
}) {
  const [goal, setGoal] = useState(String(currentGoal));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    const ml = Number(goal);
    if (!Number.isFinite(ml) || ml < 500 || ml > 10000) {
      setError('A meta deve ficar entre 500 ml e 10.000 ml.');
      return;
    }
    startTransition(async () => {
      const result = await updateWaterGoal(ml);
      if (!result.ok) {
        setError(result.error ?? 'Não foi possível salvar.');
        return;
      }
      onClose();
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Meta diária de água"
      description="Seu médico pode ajustar esse valor conforme peso e treino."
      footer={
        <Button block onClick={save} disabled={pending} icon={pending ? undefined : Check}>
          {pending ? 'Salvando…' : 'Salvar meta'}
        </Button>
      }
    >
      <div className="pb-4">
        <label htmlFor="meta-ml" className="mb-1.5 block text-sm font-semibold">
          Meta em mililitros
        </label>
        <div className="relative">
          <input
            id="meta-ml"
            inputMode="numeric"
            pattern="[0-9]*"
            value={goal}
            onChange={(e) => {
              setGoal(e.target.value.replace(/[^\d]/g, ''));
              setError(null);
            }}
            className="h-12 w-full rounded-xl border border-line bg-surface pl-3.5 pr-12 text-base font-semibold tabular-nums focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <span
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-subtle"
            aria-hidden
          >
            ml
          </span>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm font-medium text-danger">
            {error}
          </p>
        )}
        <p className="mt-2 text-sm text-muted">
          Referência comum: 35 ml por quilo de peso corporal.
        </p>
      </div>
    </Sheet>
  );
}

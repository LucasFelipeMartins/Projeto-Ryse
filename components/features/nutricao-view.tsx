'use client';

import { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  BrainCircuit,
  Check,
  ChevronDown,
  Flame,
  Info,
  Utensils,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  PageIntro,
  Progress,
  SectionTitle,
} from '@/components/ui';
import { CheckCircle, ChipRow, Sheet } from '@/components/ui/interactive';
import { Ring } from '@/components/charts';
import { macros, meals as seedMeals, me, type Meal } from '@/lib/data';
import { cn } from '@/lib/utils';

const DAYS = [
  { value: 'seg', label: 'Seg' },
  { value: 'ter', label: 'Ter' },
  { value: 'qua', label: 'Qua' },
  { value: 'qui', label: 'Hoje' },
  { value: 'sex', label: 'Sex' },
  { value: 'sab', label: 'Sáb' },
  { value: 'dom', label: 'Dom' },
] as const;

type Day = (typeof DAYS)[number]['value'];

export function NutricaoView() {
  const [day, setDay] = useState<Day>('qui');
  const [meals, setMeals] = useState<Meal[]>(seedMeals);
  const [openId, setOpenId] = useState<string | null>('m3');
  const [swapMeal, setSwapMeal] = useState<Meal | null>(null);

  const toggle = (id: string) =>
    setMeals((prev) => prev.map((m) => (m.id === id ? { ...m, done: !m.done } : m)));

  const eaten = useMemo(
    () => meals.filter((m) => m.done).reduce((sum, m) => sum + m.kcal, 0),
    [meals],
  );
  const total = useMemo(() => meals.reduce((sum, m) => sum + m.kcal, 0), [meals]);
  const doneCount = meals.filter((m) => m.done).length;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow={me.plan}
        title="Meu cardápio"
        description="Protocolo de hipertrofia limpa, ajustado ao seu último check-in."
      />

      {/* Dias da semana: fila rolável — melhor que um select no mobile. */}
      <ChipRow options={DAYS as unknown as { value: Day; label: string }[]} value={day} onChange={setDay} />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ------------------------------------------------ resumo do dia */}
        <Card className="lg:col-span-1">
          <div className="flex items-center gap-5">
            <Ring
              size={104}
              value={eaten}
              max={total}
              display={eaten.toLocaleString('pt-BR')}
              unit={`de ${total.toLocaleString('pt-BR')} kcal`}
              label="Consumido"
              color="brand"
            />
            <div className="min-w-0 flex-1 space-y-3">
              {macros.map((m, i) => (
                <div key={m.label}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{m.label}</span>
                    <span className="shrink-0 text-sm tabular-nums text-muted">
                      {m.current}/{m.target}
                      {m.unit}
                    </span>
                  </div>
                  <Progress
                    value={(m.current / m.target) * 100}
                    tone={(['cat1', 'cat2', 'cat3'] as const)[i]}
                    label={`${m.label}: ${m.current} de ${m.target}${m.unit}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3.5 py-3">
            <Flame className="h-4 w-4 shrink-0 text-brand" aria-hidden />
            <p className="text-sm text-muted">
              <strong className="text-fg">{doneCount} de {meals.length}</strong> refeições
              registradas hoje.
            </p>
          </div>
        </Card>

        {/* ------------------------------------------------ refeições */}
        <section className="lg:col-span-2">
          <SectionTitle
            title="Refeições"
            hint="Toque para ver os itens e marcar como feita."
            className="lg:hidden"
          />

          <div className="space-y-3">
            {meals.map((meal) => {
              const open = openId === meal.id;
              return (
                <Card key={meal.id} inset className="overflow-hidden">
                  <div className="flex items-start gap-3 p-4">
                    <CheckCircle
                      checked={meal.done}
                      onChange={() => toggle(meal.id)}
                      label={`Marcar ${meal.slot} como registrada`}
                    />

                    <button
                      onClick={() => setOpenId(open ? null : meal.id)}
                      aria-expanded={open}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-2xs font-bold uppercase tracking-wider text-subtle">
                          {meal.slot}
                        </span>
                        <span className="text-2xs text-subtle">·</span>
                        <span className="text-2xs font-medium text-subtle">{meal.time}</span>
                      </div>
                      <h3
                        className={cn(
                          'mt-1 text-base font-semibold leading-snug',
                          meal.done && 'text-muted line-through decoration-line-strong',
                        )}
                      >
                        {meal.title}
                      </h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                        <span className="font-semibold tabular-nums text-fg">
                          {meal.kcal} kcal
                        </span>
                        <span className="tabular-nums">
                          {meal.macros.p} P · {meal.macros.c} C · {meal.macros.g} G
                        </span>
                      </div>
                    </button>

                    <ChevronDown
                      className={cn(
                        'mt-1 h-5 w-5 shrink-0 text-subtle transition-transform',
                        open && 'rotate-180',
                      )}
                      aria-hidden
                    />
                  </div>

                  {open && (
                    <div className="animate-fade-in border-t border-line bg-surface-2/60 px-4 py-4">
                      <ul className="space-y-2">
                        {meal.items.map((item) => (
                          <li key={item} className="flex items-start gap-2.5 text-sm">
                            <Check
                              className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                              strokeWidth={2.5}
                              aria-hidden
                            />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>

                      {meal.swappable && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={ArrowLeftRight}
                          className="mt-4"
                          onClick={() => setSwapMeal(meal)}
                        >
                          Substituir alimento
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      </div>

      <Card className="flex items-start gap-3 border-brand-line bg-brand-soft">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-text" aria-hidden />
        <p className="text-sm text-muted">
          As substituições sugeridas mantêm calorias e carga glicêmica equivalentes.
          Trocas fora da lista precisam de aprovação de {me.coach}.
        </p>
      </Card>

      {/* ------------------------------------------------ folha de troca */}
      <Sheet
        open={swapMeal !== null}
        onClose={() => setSwapMeal(null)}
        title="Substituir alimento"
        description={swapMeal ? `${swapMeal.slot} · ${swapMeal.title}` : undefined}
        footer={
          <Button block onClick={() => setSwapMeal(null)}>
            Confirmar substituição
          </Button>
        }
      >
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-brand-line bg-brand-soft p-3.5">
          <BrainCircuit className="mt-0.5 h-4 w-4 shrink-0 text-brand-text" aria-hidden />
          <p className="text-sm text-muted">
            Equivalências calculadas pela IA e pré-aprovadas no seu protocolo.
          </p>
        </div>

        <ul className="space-y-2 pb-4">
          {[
            { from: '200 g de batata doce', to: '160 g de mandioca', delta: 'mesma carga glicêmica' },
            { from: '200 g de batata doce', to: '150 g de arroz branco', delta: '+2 g de carboidrato' },
            { from: '180 g de frango', to: '170 g de tilápia', delta: '-3 g de proteína' },
            { from: '180 g de frango', to: '160 g de patinho', delta: '+4 g de gordura' },
          ].map((opt) => (
            <li key={opt.to}>
              <button className="tap flex w-full items-center gap-3 rounded-xl border border-line p-3.5 text-left transition-colors hover:border-brand">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
                  <Utensils className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{opt.to}</span>
                  <span className="mt-0.5 block text-sm text-muted">no lugar de {opt.from}</span>
                </span>
                <Badge tone="neutral">{opt.delta}</Badge>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}

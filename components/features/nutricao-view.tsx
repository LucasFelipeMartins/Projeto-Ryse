'use client';

import { useOptimistic, useState, useTransition } from 'react';
import { ArrowLeftRight, BrainCircuit, Check, ChevronDown, Flame, Info, Utensils } from 'lucide-react';
import { Badge, Button, Card, EmptyState, PageIntro, Progress, SectionTitle } from '@/components/ui';
import { CheckCircle, Sheet } from '@/components/ui/interactive';
import { Ring } from '@/components/charts';
import { toggleMeal } from '@/lib/actions/patient';
import type { MealView, NutritionView } from '@/lib/queries/patient';
import { cn } from '@/lib/utils';

export function NutricaoView({ data }: { data: NutritionView }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [swapMeal, setSwapMeal] = useState<MealView | null>(null);
  const [, startTransition] = useTransition();

  // A marcação responde na hora; o servidor confirma logo em seguida.
  const [meals, setOptimistic] = useOptimistic(
    data.meals,
    (current: MealView[], toggled: { id: string; done: boolean }) =>
      current.map((m) => (m.id === toggled.id ? { ...m, done: toggled.done } : m)),
  );

  const onToggle = (meal: MealView) => {
    const next = !meal.done;
    startTransition(async () => {
      setOptimistic({ id: meal.id, done: next });
      await toggleMeal(meal.id, next);
    });
  };

  if (!data.planId) {
    return (
      <div className="space-y-6">
        <PageIntro title="Meu cardápio" />
        <Card>
          <EmptyState
            icon={Utensils}
            title="Nenhum plano nutricional ativo"
            description="Assim que seu profissional montar o cardápio, ele aparece aqui com as refeições do dia."
          />
        </Card>
      </div>
    );
  }

  const consumed = meals.filter((m) => m.done);
  const kcal = consumed.reduce((s, m) => s + m.kcal, 0);
  const macros = consumed.reduce(
    (acc, m) => ({
      p: acc.p + m.macros.p,
      c: acc.c + m.macros.c,
      g: acc.g + m.macros.g,
    }),
    { p: 0, c: 0, g: 0 },
  );

  const rows = [
    { label: 'Proteínas', current: macros.p, target: data.target.protein },
    { label: 'Carboidratos', current: macros.c, target: data.target.carb },
    { label: 'Gorduras', current: macros.g, target: data.target.fat },
  ];

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow={data.title}
        title="Meu cardápio"
        description="Marque cada refeição conforme for comendo — é isso que alimenta a análise."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ------------------------------------------------ resumo do dia */}
        <Card className="lg:col-span-1">
          <div className="flex items-center gap-5">
            <Ring
              size={104}
              value={kcal}
              max={data.target.kcal || 1}
              display={kcal.toLocaleString('pt-BR')}
              unit={`de ${data.target.kcal.toLocaleString('pt-BR')} kcal`}
              label="Consumido"
              color="brand"
            />
            <div className="min-w-0 flex-1 space-y-3">
              {rows.map((m, i) => (
                <div key={m.label}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{m.label}</span>
                    <span className="shrink-0 text-sm tabular-nums text-muted">
                      {m.current}/{m.target}g
                    </span>
                  </div>
                  <Progress
                    value={m.target ? (m.current / m.target) * 100 : 0}
                    tone={(['cat1', 'cat2', 'cat3'] as const)[i]}
                    label={`${m.label}: ${m.current} de ${m.target}g`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3.5 py-3">
            <Flame className="h-4 w-4 shrink-0 text-brand" aria-hidden />
            <p className="text-sm text-muted">
              <strong className="text-fg">
                {consumed.length} de {meals.length}
              </strong>{' '}
              refeições registradas hoje.
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
                      onChange={() => onToggle(meal)}
                      label={`Marcar ${meal.label} como registrada`}
                    />

                    <button
                      onClick={() => setOpenId(open ? null : meal.id)}
                      aria-expanded={open}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-2xs font-bold uppercase tracking-wider text-subtle">
                          {meal.label}
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
          Trocas fora da lista precisam de aprovação do seu profissional.
        </p>
      </Card>

      <Sheet
        open={swapMeal !== null}
        onClose={() => setSwapMeal(null)}
        title="Substituir alimento"
        description={swapMeal ? `${swapMeal.label} · ${swapMeal.title}` : undefined}
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

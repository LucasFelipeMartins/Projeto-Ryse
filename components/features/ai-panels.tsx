'use client';

import { useState, useTransition } from 'react';
import {
  AlertTriangle,
  Apple,
  ArrowRight,
  BrainCircuit,
  CalendarClock,
  Check,
  ChevronDown,
  Clock,
  Dumbbell,
  Flame,
  Info,
  Loader2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wand2,
  type LucideIcon,
} from 'lucide-react';
import { Badge, Button, Card, SectionTitle } from '@/components/ui';
import {
  gerarDieta,
  gerarFichaDeTreino,
  gerarRelatorio,
  type AiActionResult,
} from '@/lib/actions/ai';
import type { ReportArea } from '@/lib/ai/generate';
import { AI_DISCLAIMER, type AiDiet, type AiReport, type AiWorkoutPlan } from '@/lib/ai/schemas';
import { cn, relativeTime } from '@/lib/utils';

/**
 * Superfícies de IA do paciente.
 *
 * Todas compartilham o mesmo contrato de estado, porque o usuário precisa
 * sempre saber em qual dos cinco momentos está:
 *
 *   pronto -> gerando -> resultado
 *                     -> erro (com o motivo e o que fazer)
 *                     -> limite atingido (com a data em que reabre)
 *
 * O limite vem do servidor. O que aparece aqui é a **explicação** dele: um
 * botão desabilitado sem data ao lado é a forma mais rápida de transformar
 * uma regra razoável em frustração.
 */

/* --------------------------------------------------------------- QUOTA -- */

export type QuotaView = {
  used: boolean;
  label: string;
  window: 'mes' | 'semana';
  availableOn: string;
};

function QuotaHint({ quota }: { quota: QuotaView }) {
  const janela = quota.window === 'mes' ? 'por mês' : 'por semana';

  return (
    <p className="flex items-center gap-1.5 text-sm text-muted">
      <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {quota.used ? (
        <>
          Limite usado. Disponível de novo em{' '}
          <strong className="text-fg">{quota.availableOn}</strong>.
        </>
      ) : (
        <>1 solicitação {janela} · disponível agora</>
      )}
    </p>
  );
}

/* ---------------------------------------------------------- DISCLAIMER -- */

function Disclaimer() {
  return (
    <p className="mt-5 flex items-start gap-2 rounded-xl border border-line bg-surface-2 p-3 text-sm text-muted">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-subtle" aria-hidden />
      {AI_DISCLAIMER}
    </p>
  );
}

/* --------------------------------------------------------- CASCA COMUM -- */

function AiShell({
  icon: Icon,
  title,
  description,
  quota,
  cta,
  onRun,
  pending,
  error,
  limited,
  hasResult,
  lastAt,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  quota: QuotaView;
  cta: string;
  onRun: () => void;
  pending: boolean;
  error: string | null;
  limited: boolean;
  hasResult: boolean;
  lastAt?: string | null;
  children?: React.ReactNode;
}) {
  const bloqueado = (quota.used && !hasResult) || limited;

  return (
    <section>
      <Card>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
            <Icon className="h-5 w-5" aria-hidden />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight">{title}</h2>
              <Badge tone="brand" icon={Sparkles}>
                IA
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted">{description}</p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                icon={pending ? undefined : Wand2}
                disabled={pending || bloqueado}
                onClick={onRun}
                className="w-full sm:w-auto"
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Gerando…
                  </>
                ) : hasResult ? (
                  'Gerar de novo'
                ) : (
                  cta
                )}
              </Button>

              <QuotaHint quota={quota} />
            </div>

            {pending && (
              <p
                role="status"
                className="mt-3 flex items-center gap-2 rounded-xl border border-brand-line bg-brand-soft p-3 text-sm text-brand-text"
              >
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                Analisando seus dados. Isso costuma levar de 10 a 30 segundos —
                pode deixar a tela aberta.
              </p>
            )}

            {error && (
              <p
                role="alert"
                className={cn(
                  'mt-3 flex items-start gap-2 rounded-xl border p-3 text-sm',
                  limited
                    ? 'border-warn/25 bg-warn-soft text-warn'
                    : 'border-danger/25 bg-danger-soft text-danger',
                )}
              >
                {limited ? (
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                )}
                {error}
              </p>
            )}

            {lastAt && !pending && (
              <p className="mt-3 text-sm text-subtle">
                Última geração {relativeTime(lastAt)}.
              </p>
            )}
          </div>
        </div>

        {children}
      </Card>
    </section>
  );
}

/* ------------------------------------------------------------ RELATÓRIO -- */

const AREA_META: Record<ReportArea, { title: string; description: string; icon: LucideIcon }> = {
  exames: {
    title: 'Relatório de exames',
    description:
      'A IA lê seus marcadores, compara com as faixas de referência e aponta tendências entre coletas.',
    icon: TrendingUp,
  },
  saude: {
    title: 'Relatório de saúde',
    description:
      'Cruza check-ins, evolução corporal e histórico para mostrar como você está de fato.',
    icon: BrainCircuit,
  },
  treino: {
    title: 'Relatório de treino',
    description:
      'Avalia frequência, consistência e desempenho comparando o planejado com o realizado.',
    icon: Dumbbell,
  },
  nutricao: {
    title: 'Relatório de nutrição',
    description:
      'Analisa adesão às refeições, consistência semanal e coerência com o seu objetivo.',
    icon: Apple,
  },
};

export function AiReportPanel({
  area,
  quota,
  initial,
  initialAt,
}: {
  area: ReportArea;
  quota: QuotaView;
  initial?: AiReport | null;
  initialAt?: string | null;
}) {
  const meta = AREA_META[area];
  const [report, setReport] = useState<AiReport | null>(initial ?? null);
  const [lastAt, setLastAt] = useState<string | null>(initialAt ?? null);
  const [error, setError] = useState<string | null>(null);
  const [limited, setLimited] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = () => {
    setError(null);
    setLimited(false);

    startTransition(async () => {
      const result: AiActionResult<AiReport> = await gerarRelatorio(area);

      if (!result.ok) {
        setError(result.error);
        setLimited(Boolean(result.limited));
        return;
      }

      setReport(result.data);
      setLastAt(result.generatedAt);
    });
  };

  return (
    <AiShell
      icon={meta.icon}
      title={meta.title}
      description={meta.description}
      quota={quota}
      cta="Gerar relatório com IA"
      onRun={run}
      pending={pending}
      error={error}
      limited={limited}
      hasResult={Boolean(report)}
      lastAt={lastAt}
    >
      {report && (
        <div className="mt-5 border-t border-line pt-5">
          <ReportBody report={report} />
          <Disclaimer />
        </div>
      )}
    </AiShell>
  );
}

/** Estrutura fixa do relatório — a mesma em todas as áreas. */
export function ReportBody({ report }: { report: AiReport }) {
  const blocos: { title: string; items: string[]; tone?: 'ok' | 'warn' }[] = [
    { title: 'Principais observações', items: report.observacoes },
    { title: 'Pontos positivos', items: report.pontosPositivos, tone: 'ok' },
    { title: 'Pontos de atenção', items: report.pontosAtencao, tone: 'warn' },
    { title: 'Recomendações', items: report.recomendacoes },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-2xs font-bold uppercase tracking-wider text-subtle">
          Resumo geral
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed">{report.resumo}</p>
      </div>

      {blocos
        .filter((b) => b.items.length > 0)
        .map((bloco) => (
          <div key={bloco.title}>
            <h3 className="text-2xs font-bold uppercase tracking-wider text-subtle">
              {bloco.title}
            </h3>
            <ul className="mt-2 space-y-2">
              {bloco.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
                  <span
                    className={cn(
                      'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                      bloco.tone === 'ok'
                        ? 'bg-success'
                        : bloco.tone === 'warn'
                          ? 'bg-warn'
                          : 'bg-brand',
                    )}
                    aria-hidden
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}

      <div>
        <h3 className="text-2xs font-bold uppercase tracking-wider text-subtle">
          Evolução
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed">{report.evolucao}</p>
      </div>

      {report.proximosPassos.length > 0 && (
        <div className="rounded-xl border border-brand-line bg-brand-soft p-4">
          <h3 className="text-2xs font-bold uppercase tracking-wider text-brand-text">
            Próximos passos
          </h3>
          <ol className="mt-2 space-y-2">
            {report.proximosPassos.map((passo, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-2xs font-bold text-brand-on">
                  {i + 1}
                </span>
                {passo}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- DIETA -- */

export function AiDietPanel({
  quota,
  initial,
  initialAt,
}: {
  quota: QuotaView;
  initial?: AiDiet | null;
  initialAt?: string | null;
}) {
  const [diet, setDiet] = useState<AiDiet | null>(initial ?? null);
  const [lastAt, setLastAt] = useState<string | null>(initialAt ?? null);
  const [error, setError] = useState<string | null>(null);
  const [limited, setLimited] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = () => {
    setError(null);
    setLimited(false);

    startTransition(async () => {
      const result = await gerarDieta();

      if (!result.ok) {
        setError(result.error);
        setLimited(Boolean(result.limited));
        return;
      }

      setDiet(result.data);
      setLastAt(result.generatedAt);
    });
  };

  return (
    <AiShell
      icon={Apple}
      title="Criar dieta com IA"
      description="Um cardápio montado a partir do seu objetivo, peso, altura, rotina, preferências e restrições."
      quota={quota}
      cta="Criar dieta com IA"
      onRun={run}
      pending={pending}
      error={error}
      limited={limited}
      hasResult={Boolean(diet)}
      lastAt={lastAt}
    >
      {diet && (
        <div className="mt-5 border-t border-line pt-5">
          <DietBody diet={diet} />
          <Disclaimer />
        </div>
      )}
    </AiShell>
  );
}

export function DietBody({ diet }: { diet: AiDiet }) {
  const [aberta, setAberta] = useState<number | null>(0);

  return (
    <div>
      <h3 className="text-lg font-bold tracking-tight">{diet.titulo}</h3>

      {diet.estrategia && (
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{diet.estrategia}</p>
      )}

      {/* ------------------------------------------------ alvo do dia */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        {[
          { label: 'kcal', value: diet.kcalAlvo, icon: Flame },
          { label: 'Prot.', value: `${diet.proteina} g` },
          { label: 'Carb.', value: `${diet.carboidrato} g` },
          { label: 'Gord.', value: `${diet.gordura} g` },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-line bg-surface-2 px-2 py-2.5 text-center"
          >
            <p className="text-base font-bold tabular-nums">{m.value}</p>
            <p className="mt-0.5 text-2xs font-semibold uppercase tracking-wide text-subtle">
              {m.label}
            </p>
          </div>
        ))}
      </div>

      {/* ------------------------------------------------ refeições */}
      <ul className="mt-4 space-y-2">
        {diet.refeicoes.map((refeicao, i) => {
          const aberto = aberta === i;

          return (
            <li key={i} className="overflow-hidden rounded-xl border border-line">
              <button
                type="button"
                onClick={() => setAberta(aberto ? null : i)}
                aria-expanded={aberto}
                className="tap flex w-full items-center gap-3 bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-2"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-2xs font-bold tabular-nums text-muted">
                  {refeicao.horario || '—'}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {refeicao.nome}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-muted">
                    {refeicao.titulo}
                  </span>
                </span>

                <span className="shrink-0 text-sm font-semibold tabular-nums text-muted">
                  {refeicao.kcal} kcal
                </span>

                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-subtle transition-transform',
                    aberto && 'rotate-180',
                  )}
                  aria-hidden
                />
              </button>

              {aberto && (
                <div className="border-t border-line bg-surface-2 px-4 py-3">
                  <ul className="space-y-1.5">
                    {refeicao.itens.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm">
                        <span
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                          aria-hidden
                        />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-2.5 text-2xs font-semibold uppercase tracking-wide text-subtle">
                    <span>P {refeicao.proteina} g</span>
                    <span>C {refeicao.carboidrato} g</span>
                    <span>G {refeicao.gordura} g</span>
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {diet.orientacoes.length > 0 && (
        <div className="mt-4 rounded-xl border border-line bg-surface-2 p-4">
          <h4 className="text-2xs font-bold uppercase tracking-wider text-subtle">
            Orientações
          </h4>
          <ul className="mt-2 space-y-1.5">
            {diet.orientacoes.map((o, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
                {o}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- FICHA -- */

export function AiWorkoutPanel({
  quota,
  initial,
  initialAt,
}: {
  quota: QuotaView;
  initial?: AiWorkoutPlan | null;
  initialAt?: string | null;
}) {
  const [plan, setPlan] = useState<AiWorkoutPlan | null>(initial ?? null);
  const [lastAt, setLastAt] = useState<string | null>(initialAt ?? null);
  const [error, setError] = useState<string | null>(null);
  const [limited, setLimited] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = () => {
    setError(null);
    setLimited(false);

    startTransition(async () => {
      const result = await gerarFichaDeTreino();

      if (!result.ok) {
        setError(result.error);
        setLimited(Boolean(result.limited));
        return;
      }

      setPlan(result.data);
      setLastAt(result.generatedAt);
    });
  };

  return (
    <AiShell
      icon={Dumbbell}
      title="Criar ficha de treino com IA"
      description="Uma divisão montada para o seu nível, seu objetivo e os dias que você tem disponíveis."
      quota={quota}
      cta="Criar ficha de treino com IA"
      onRun={run}
      pending={pending}
      error={error}
      limited={limited}
      hasResult={Boolean(plan)}
      lastAt={lastAt}
    >
      {plan && (
        <div className="mt-5 border-t border-line pt-5">
          <WorkoutBody plan={plan} />
          <Disclaimer />
        </div>
      )}
    </AiShell>
  );
}

export function WorkoutBody({ plan }: { plan: AiWorkoutPlan }) {
  const [aberta, setAberta] = useState(0);
  const ficha = plan.fichas[aberta];

  return (
    <div>
      <h3 className="text-lg font-bold tracking-tight">{plan.titulo}</h3>

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {plan.divisao && <Badge tone="brand">{plan.divisao}</Badge>}
        <span className="text-sm text-muted">
          {plan.fichas.length} {plan.fichas.length === 1 ? 'ficha' : 'fichas'}
        </span>
      </div>

      {plan.estrategia && (
        <p className="mt-2 text-sm leading-relaxed text-muted">{plan.estrategia}</p>
      )}

      {plan.fichas.length > 0 && (
        <>
          {/* Seletor de ficha — rola na horizontal quando não cabe. */}
          <div className="no-scrollbar -mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
            {plan.fichas.map((f, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setAberta(i)}
                aria-pressed={aberta === i}
                className={cn(
                  'tap shrink-0 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors',
                  aberta === i
                    ? 'border-brand bg-brand text-brand-on'
                    : 'border-line bg-surface text-muted hover:border-line-strong hover:text-fg',
                )}
              >
                {f.letra} · {f.foco || f.titulo}
              </button>
            ))}
          </div>

          {ficha && (
            <div className="mt-4 overflow-hidden rounded-xl border border-line">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-surface-2 px-4 py-3">
                <p className="text-sm font-semibold">
                  Ficha {ficha.letra} — {ficha.titulo || ficha.foco}
                </p>
                <span className="flex items-center gap-1.5 text-sm text-muted">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  {ficha.duracaoMin} min
                </span>
              </div>

              {/* A tabela rola sozinha no celular; a página não. */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-2xs uppercase tracking-wide text-subtle">
                      <th className="px-4 py-2 font-bold">Exercício</th>
                      <th className="px-3 py-2 font-bold">Séries</th>
                      <th className="px-3 py-2 font-bold">Reps</th>
                      <th className="px-3 py-2 font-bold">Carga</th>
                      <th className="px-4 py-2 font-bold">Descanso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {ficha.exercicios.map((ex, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5">
                          <span className="block font-semibold">{ex.nome}</span>
                          <span className="mt-0.5 block text-sm text-muted">
                            {ex.musculo}
                          </span>
                          {ex.observacao && (
                            <span className="mt-1 block text-sm text-warn">
                              {ex.observacao}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">{ex.series}</td>
                        <td className="px-3 py-2.5 tabular-nums">{ex.repeticoes}</td>
                        <td className="px-3 py-2.5">{ex.carga}</td>
                        <td className="px-4 py-2.5 tabular-nums">{ex.descanso}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {plan.orientacoes.length > 0 && (
        <div className="mt-4 rounded-xl border border-line bg-surface-2 p-4">
          <h4 className="text-2xs font-bold uppercase tracking-wider text-subtle">
            Orientações
          </h4>
          <ul className="mt-2 space-y-1.5">
            {plan.orientacoes.map((o, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                {o}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------- SEM PROVEDOR ----- */

/** Mostrado no lugar do painel quando não há provedor de IA configurado. */
export function AiUnavailableCard({ area }: { area: string }) {
  return (
    <Card className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-subtle">
        <Info className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">Análise por IA indisponível</h2>
        <p className="mt-1 text-sm text-muted">
          A geração de {area} por inteligência artificial ainda não foi habilitada
          nesta instalação. Todo o restante da tela funciona normalmente.
        </p>
      </div>
    </Card>
  );
}

export function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return <SectionTitle title={title} hint={hint} />;
}

import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Dumbbell,
  Flame,
  MessageSquare,
  Sparkles,
  TrendingUp,
  UtensilsCrossed,
} from 'lucide-react';
import {
  AiPanel,
  Badge,
  ButtonLink,
  Card,
  PageIntro,
  Progress,
  SectionTitle,
} from '@/components/ui';
import { Ring } from '@/components/charts';
import { HydrationCard } from '@/components/features/hydration';
import { RoleSwitchBanner } from '@/components/layout/app-shell';
import {
  aiBrief,
  dailyRings,
  macros,
  me,
  meals,
  patientTimeline,
  workoutToday,
} from '@/lib/data';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Início' };

const toneDot: Record<string, string> = {
  success: 'bg-success',
  brand: 'bg-brand',
  warn: 'bg-warn',
  danger: 'bg-danger',
  neutral: 'bg-subtle',
};

export default function InicioPage() {
  const nextMeal = meals.find((m) => !m.done) ?? meals[meals.length - 1];
  const doneSets = workoutToday.exercises.filter((e) => e.done).length;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Quinta, 25 de agosto"
        title={`Bom dia, ${me.firstName}`}
        description="Seu plano de hoje está pronto. Vamos manter a sequência."
        action={
          <Badge tone="brand" icon={Flame} className="px-2.5 py-1 text-sm">
            {me.streak} dias
          </Badge>
        }
      />

      <RoleSwitchBanner to="pro" />

      {/* ------------------------------------------------ parecer da IA */}
      <AiPanel>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge
            tone="brand"
            icon={Sparkles}
            className="border-brand/40 bg-brand/15 text-brand"
          >
            Análise semanal
          </Badge>
          <span className="text-sm text-ink-on/55">Atualizado {aiBrief.updated}</span>
        </div>

        <h2 className="max-w-xl text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
          {aiBrief.headline}
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-on/70 sm:text-base">
          {aiBrief.body}
        </p>

        {/* sinais com rótulo textual — a cor nunca carrega a informação sozinha */}
        <dl className="mt-5 grid grid-cols-3 gap-2 sm:max-w-md">
          {aiBrief.signals.map((s) => (
            <div key={s.label} className="rounded-xl bg-ink-on/[0.07] px-3 py-2.5">
              <dt className="truncate text-2xs font-medium text-ink-on/55">{s.label}</dt>
              <dd className="mt-0.5 flex items-center gap-1.5">
                <span
                  className={cn('h-1.5 w-1.5 shrink-0 rounded-full', toneDot[s.tone])}
                  aria-hidden
                />
                <span className="text-sm font-bold tabular-nums">{s.value}</span>
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <ButtonLink href="/progresso" iconRight={ArrowRight} className="w-full sm:w-auto">
            Ver meu progresso
          </ButtonLink>
          <span className="hidden text-sm text-ink-on/50 sm:inline">
            Revisado por {me.coach}
          </span>
        </div>
      </AiPanel>

      {/* ------------------------------------------------ metas do dia */}
      <section>
        <SectionTitle
          title="Metas de hoje"
          action={
            <Link
              href="/nutricao"
              className="text-sm font-semibold text-brand-text hover:underline"
            >
              Detalhes
            </Link>
          }
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="grid grid-cols-3 gap-1">
              <Ring
                size={96}
                value={dailyRings.kcal.current}
                max={dailyRings.kcal.target}
                display={dailyRings.kcal.current.toLocaleString('pt-BR')}
                unit="kcal"
                label="Calorias"
                color="brand"
              />
              <Ring
                size={96}
                value={dailyRings.steps.current}
                max={dailyRings.steps.target}
                display={`${(dailyRings.steps.current / 1000).toFixed(1).replace('.', ',')} k`}
                unit="passos"
                label="Passos"
                color="cat-2"
              />
              <Ring
                size={96}
                value={doneSets}
                max={workoutToday.exercises.length}
                display={`${doneSets}/${workoutToday.exercises.length}`}
                unit="exercícios"
                label="Treino"
                color="cat-3"
              />
            </div>

            <div className="mt-5 space-y-3 border-t border-line pt-5">
              {macros.map((m, i) => (
                <div key={m.label}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{m.label}</span>
                    <span className="text-sm tabular-nums text-muted">
                      <strong className="text-fg">{m.current}</strong> / {m.target}
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
          </Card>

          <HydrationCard />
        </div>
      </section>

      {/* ------------------------------------------------ treino + refeição */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Link href="/treino" className="tap group block">
          <Card className="h-full transition-colors hover:border-line-strong">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-muted">
                  <Dumbbell className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <div>
                  <h3 className="text-sm font-semibold">Treino de hoje</h3>
                  <p className="text-sm text-muted">Ficha {workoutToday.letter}</p>
                </div>
              </div>
              <Badge tone="warn">Pendente</Badge>
            </div>

            <p className="mt-4 text-xl font-bold tracking-tight">{workoutToday.focus}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {workoutToday.duration} min
              </span>
              <span className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5" aria-hidden />
                {workoutToday.volume}
              </span>
            </div>

            <span className="mt-5 flex items-center gap-1 text-sm font-semibold text-brand-text">
              Abrir sessão
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Card>
        </Link>

        <Link href="/nutricao" className="tap group block">
          <Card className="h-full transition-colors hover:border-line-strong">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-muted">
                  <UtensilsCrossed className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <div>
                  <h3 className="text-sm font-semibold">Próxima refeição</h3>
                  <p className="text-sm text-muted">
                    {nextMeal.slot} · {nextMeal.time}
                  </p>
                </div>
              </div>
              <Badge tone="neutral">{nextMeal.kcal} kcal</Badge>
            </div>

            <p className="mt-4 text-xl font-bold tracking-tight">{nextMeal.title}</p>
            <p className="mt-2 line-clamp-2 text-sm text-muted">
              {nextMeal.items.join(' · ')}
            </p>

            <span className="mt-5 flex items-center gap-1 text-sm font-semibold text-brand-text">
              Ver cardápio
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Card>
        </Link>
      </div>

      {/* ------------------------------------------------ atalhos */}
      <section>
        <SectionTitle title="Atalhos" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { href: '/checkin', label: 'Check-in', hint: 'Semanal', icon: ClipboardCheck },
            { href: '/mensagens', label: 'Mensagens', hint: '1 nova', icon: MessageSquare },
            { href: '/progresso', label: 'Exames', hint: '6 marcadores', icon: Activity },
            { href: '/progresso', label: 'Evolução', hint: '-2,3 kg', icon: TrendingUp },
          ].map((a) => (
            <Link key={a.label} href={a.href} className="tap">
              <Card className="h-full transition-colors hover:border-line-strong">
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
                  <a.icon className="h-5 w-5" aria-hidden />
                </span>
                <p className="text-sm font-semibold">{a.label}</p>
                <p className="mt-0.5 text-sm text-muted">{a.hint}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ linha do tempo */}
      <section>
        <SectionTitle title="Atividade recente" hint="O que o Ryse registrou por você." />
        <Card inset className="divide-y divide-line">
          {patientTimeline.map((item) => (
            <div key={item.title} className="flex gap-3 px-4 py-3.5">
              <span
                className={cn(
                  'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                  toneDot[item.tone],
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-0.5 text-sm text-muted">{item.desc}</p>
              </div>
              <span className="shrink-0 text-2xs font-medium text-subtle">{item.t}</span>
            </div>
          ))}
        </Card>
      </section>

      <Card className="flex flex-col items-start gap-4 border-brand-line bg-brand-soft sm:flex-row sm:items-center">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-on">
          <BrainCircuit className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold">Toda alteração passa por um humano</h3>
          <p className="mt-0.5 text-sm text-muted">
            A IA propõe ajustes; {me.coach} aprova antes de qualquer mudança no seu
            protocolo.
          </p>
        </div>
      </Card>
    </div>
  );
}

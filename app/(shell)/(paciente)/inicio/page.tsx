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
  UserRoundSearch,
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
import { LiveRefresh } from '@/components/features/live-refresh';
import { requirePatient } from '@/lib/supabase/server';
import {
  getCheckinStatus,
  getHydration,
  getLatestDecision,
  getNutrition,
  getStreak,
  getTraining,
} from '@/lib/queries/patient';
import { greeting } from '@/lib/utils';

/**
 * As tabelas que fazem esta tela mudar. Um registro de água feito no celular
 * atualiza a aba aberta no computador sem ninguém apertar F5.
 */
const TABELAS_AO_VIVO = [
  'hydration_logs',
  'meal_logs',
  'workout_sessions',
  'body_metrics',
  'checkins',
];

export const metadata = { title: 'Início' };

const REVIEW_LABEL: Record<string, string> = {
  aprovado: 'ajuste aprovado',
  editado: 'ajuste revisado',
  rejeitado: 'protocolo mantido',
};

export default async function InicioPage() {
  const user = await requirePatient();

  // Consultas independentes disparam juntas.
  const [hydration, nutrition, training, decision, streak, checkin] = await Promise.all([
    // A meta de água sai do cálculo, não de um número guardado: o peso mais
    // recente entra na conta a cada leitura.
    getHydration(user.id, {
      heightCm: user.heightCm,
      birthDate: user.birthDate,
      activityLevel: user.activityLevel,
      trainingDays: user.trainingDays,
      overrideMl: user.waterGoalOverrideMl,
      timezone: user.timezone,
    }),
    getNutrition(user.id),
    getTraining(user.id),
    getLatestDecision(user.id),
    getStreak(user.id),
    getCheckinStatus(user.id, user.timezone),
  ]);

  const firstName = user.fullName.split(' ')[0];
  const nextMeal = nutrition.meals.find((m) => !m.done);
  const mealsDone = nutrition.meals.filter((m) => m.done).length;

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="space-y-6">
      <LiveRefresh patientId={user.id} tables={TABELAS_AO_VIVO} channel="inicio" />

      <PageIntro
        eyebrow={today.charAt(0).toUpperCase() + today.slice(1)}
        title={`${greeting()}, ${firstName}`}
        description={
          nutrition.planId
            ? 'Seu plano de hoje está pronto.'
            : 'Bem-vindo ao Ryse. Vamos configurar seu acompanhamento.'
        }
        action={
          streak > 0 ? (
            <Badge tone="brand" icon={Flame} className="px-2.5 py-1 text-sm">
              {streak} {streak === 1 ? 'dia' : 'dias'}
            </Badge>
          ) : undefined
        }
      />

      {/*
        Check-in da semana em aberto.

        Fica no topo porque é a única pendência que o app cobra do usuário —
        e porque tudo o mais (evolução, contexto da IA, peso da hidratação)
        depende dele estar em dia.
      */}
      {checkin.pending && (
        <Link href="/checkin" className="tap block">
          <Card className="flex items-start gap-3 border-warn/30 bg-warn-soft transition-colors hover:border-warn">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warn text-white">
              <ClipboardCheck className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold">Seu check-in está pendente</h2>
              <p className="mt-1 text-sm text-muted">
                Leva dois minutos e é o que mantém peso, dieta e treino calibrados
                para a semana.
              </p>
              <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-warn">
                Fazer agora
                <ChevronRight className="h-4 w-4" aria-hidden />
              </span>
            </div>
          </Card>
        </Link>
      )}

      {/* Ainda não decidiu: escolher profissional é o próximo passo. */}
      {!user.professionalId && !user.choseSoloAt && (
        <Link href="/profissionais" className="tap block">
          <Card className="flex items-start gap-3 border-brand-line bg-brand-soft transition-colors hover:border-brand">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-on">
              <UserRoundSearch className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold">Escolha quem vai te acompanhar</h2>
              <p className="mt-1 text-sm text-muted">
                O profissional revisa seus exames e monta dieta e treino. Você também
                pode seguir só com a análise da IA.
              </p>
              <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-text">
                Ver profissionais
                <ChevronRight className="h-4 w-4" aria-hidden />
              </span>
            </div>
          </Card>
        </Link>
      )}

      {/* Decidiu seguir sozinho: aviso discreto, sem insistir. */}
      {!user.professionalId && user.choseSoloAt && (
        <Card className="flex items-center gap-3">
          <BrainCircuit className="h-5 w-5 shrink-0 text-brand" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-muted">
            Você está no modo <strong className="text-fg">só com a IA</strong>. Exames
            enviados recebem leitura automática, sem revisão profissional.
          </p>
          <Link
            href="/profissionais"
            className="shrink-0 text-sm font-semibold text-brand-text hover:underline"
          >
            Mudar
          </Link>
        </Card>
      )}

      {/* ------------------------------------------------ parecer da IA */}
      {decision && (
        <AiPanel>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge tone="brand" icon={Sparkles} className="border-brand/40 bg-brand/15 text-brand">
              Última análise
            </Badge>
            <span className="text-sm text-ink-on/55">
              {REVIEW_LABEL[decision.status] ?? decision.status}
            </span>
          </div>

          <h2 className="max-w-xl text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
            {decision.summary}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-on/70 sm:text-base">
            {decision.action}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <ButtonLink href="/progresso" iconRight={ArrowRight} className="w-full sm:w-auto">
              Ver meu progresso
            </ButtonLink>
            <span className="hidden text-sm text-ink-on/50 sm:inline">
              Revisado por um profissional
            </span>
          </div>
        </AiPanel>
      )}

      {/* ------------------------------------------------ metas do dia */}
      <section>
        <SectionTitle
          title="Metas de hoje"
          action={
            nutrition.planId ? (
              <Link href="/nutricao" className="text-sm font-semibold text-brand-text hover:underline">
                Detalhes
              </Link>
            ) : undefined
          }
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="grid grid-cols-3 gap-1">
              <Ring
                size={96}
                value={nutrition.consumed.kcal}
                max={nutrition.target.kcal || 1}
                display={nutrition.consumed.kcal.toLocaleString('pt-BR')}
                unit={nutrition.target.kcal ? `de ${nutrition.target.kcal}` : 'kcal'}
                label="Calorias"
                color="brand"
              />
              <Ring
                size={96}
                value={hydration.totalMl}
                max={hydration.goalMl}
                display={`${(hydration.totalMl / 1000).toFixed(1).replace('.', ',')} L`}
                unit="água"
                label="Hidratação"
                color="cat-2"
              />
              <Ring
                size={96}
                value={mealsDone}
                max={nutrition.meals.length || 1}
                display={`${mealsDone}/${nutrition.meals.length}`}
                unit="refeições"
                label="Refeições"
                color="cat-3"
              />
            </div>

            {nutrition.target.protein > 0 && (
              <div className="mt-5 space-y-3 border-t border-line pt-5">
                {[
                  { label: 'Proteínas', current: nutrition.consumed.protein, target: nutrition.target.protein },
                  { label: 'Carboidratos', current: nutrition.consumed.carb, target: nutrition.target.carb },
                  { label: 'Gorduras', current: nutrition.consumed.fat, target: nutrition.target.fat },
                ].map((m, i) => (
                  <div key={m.label}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">{m.label}</span>
                      <span className="text-sm tabular-nums text-muted">
                        <strong className="text-fg">{m.current}</strong> / {m.target}g
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
            )}
          </Card>

          <HydrationCard data={hydration} />
        </div>
      </section>

      {/* ------------------------------------------------ treino + refeição */}
      {(training.today || nextMeal) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {training.today && (
            <Link href="/treino" className="tap group block">
              <Card className="h-full transition-colors hover:border-line-strong">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-muted">
                      <Dumbbell className="h-[18px] w-[18px]" aria-hidden />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold">Treino de hoje</h3>
                      <p className="text-sm text-muted">Ficha {training.today.letter}</p>
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-xl font-bold tracking-tight">{training.today.focus}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    {training.today.minutes} min
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" aria-hidden />
                    {training.today.exercises.length} exercícios
                  </span>
                </div>

                <span className="mt-5 flex items-center gap-1 text-sm font-semibold text-brand-text">
                  Abrir sessão
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Card>
            </Link>
          )}

          {nextMeal && (
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
                        {nextMeal.label} · {nextMeal.time}
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
          )}
        </div>
      )}

      {/* ------------------------------------------------ atalhos */}
      <section>
        <SectionTitle title="Atalhos" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              href: '/checkin',
              label: 'Check-in',
              hint: checkin.pending ? 'Pendente' : 'Enviado',
              icon: ClipboardCheck,
            },
            { href: '/mensagens', label: 'Mensagens', hint: 'Falar com a clínica', icon: MessageSquare },
            { href: '/progresso', label: 'Exames', hint: 'Marcadores', icon: Activity },
            { href: '/progresso', label: 'Evolução', hint: 'Peso e adesão', icon: TrendingUp },
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

      {user.professionalId && (
        <Card className="flex flex-col items-start gap-4 border-brand-line bg-brand-soft sm:flex-row sm:items-center">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-on">
            <BrainCircuit className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold">Toda alteração passa por um humano</h3>
            <p className="mt-0.5 text-sm text-muted">
              A IA propõe ajustes; um profissional aprova antes de qualquer mudança no
              seu protocolo.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

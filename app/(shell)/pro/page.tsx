import Link from 'next/link';
import {
  ArrowRight,
  BrainCircuit,
  ChevronRight,
  FileText,
  Inbox,
  UserPlus,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  PageIntro,
  SectionTitle,
  Stat,
} from '@/components/ui';
import { BarChart, LineChart } from '@/components/charts';
import { requireProfessional } from '@/lib/supabase/server';
import { getActivity, getDashboard, getReviewQueue } from '@/lib/queries/pro';
import { cn, greeting } from '@/lib/utils';

export const metadata = { title: 'Painel' };

const toneDot: Record<string, string> = {
  success: 'bg-success',
  brand: 'bg-brand',
  warn: 'bg-warn',
  danger: 'bg-danger',
  neutral: 'bg-subtle',
};

export default async function ProDashboardPage() {
  const pro = await requireProfessional();

  const [dashboard, activity, queue] = await Promise.all([
    getDashboard(pro.id),
    getActivity(pro.id),
    getReviewQueue(pro.id),
  ]);

  const { kpis, weekLabels, adherenceSeries, interventions } = dashboard;
  const lastName = pro.fullName.split(' ').slice(-1)[0];

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow={today.charAt(0).toUpperCase() + today.slice(1)}
        title={`${greeting()}, ${lastName}`}
        description="Resumo da sua clínica hoje."
        action={
          <div className="hidden gap-2 sm:flex">
            <Button variant="secondary" icon={FileText}>
              Relatório
            </Button>
            <Button icon={UserPlus}>Novo paciente</Button>
          </div>
        }
      />

      {/* ------------------------------------------------ indicadores */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pacientes ativos" value={String(kpis.activePatients)} />
        <Stat
          label="Revisões pendentes"
          value={String(kpis.pendingReviews)}
          delta={kpis.pendingReviews > 0 ? 'Ação requerida' : 'Fila vazia'}
          alert={kpis.pendingReviews > 0}
          up={kpis.pendingReviews === 0}
        />
        <Stat
          label="Adesão média"
          value={kpis.avgAdherence > 0 ? `${kpis.avgAdherence}%` : '—'}
          hint="protocolos ativos"
        />
        {/*
          O quarto indicador era o MRR. Faturamento saiu da tela do
          profissional; no lugar entra o que ele de fato acompanha no dia a
          dia — quantos pacientes ainda devem o check-in da semana.
        */}
        <Stat
          label="Check-ins pendentes"
          value={String(kpis.pendingCheckins)}
          delta={kpis.pendingCheckins > 0 ? 'Aguardando resposta' : 'Todos em dia'}
          up={kpis.pendingCheckins === 0}
        />
      </div>

      {/*
        Adesão (%) e intervenções (contagem) têm escalas diferentes.
        Em vez de forçar dois eixos no mesmo gráfico — que distorce a leitura —
        ficam em painéis irmãos, compartilhando o mesmo eixo de semanas.
      */}
      <section>
        <SectionTitle
          title="Engajamento e inteligência"
          hint="Últimas 8 semanas, mesma janela nos dois painéis."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Adesão média ao protocolo</h3>
              <p className="mt-0.5 text-sm text-muted">
                <strong className="tabular-nums text-fg">
                  {adherenceSeries[adherenceSeries.length - 1]}%
                </strong>{' '}
                na última semana
              </p>
            </div>
            <LineChart
              data={adherenceSeries}
              labels={weekLabels}
              format={{ suffix: '%' }}
              height={170}
              color="brand"
              caption={`Adesão média ao protocolo por semana, de ${Math.min(
                ...adherenceSeries,
              )}% a ${Math.max(...adherenceSeries)}%.`}
            />
          </Card>

          <Card>
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Intervenções da IA</h3>
              <p className="mt-0.5 text-sm text-muted">
                <strong className="tabular-nums text-fg">
                  {interventions[interventions.length - 1]}
                </strong>{' '}
                propostas geradas na semana
              </p>
            </div>
            <BarChart
              data={interventions}
              labels={weekLabels}
              height={170}
              color="cat-2"
              caption={`Número de propostas de ajuste geradas pela IA por semana, de ${Math.min(
                ...interventions,
              )} a ${Math.max(...interventions)}.`}
            />
          </Card>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* ------------------------------------------------ fila de revisão */}
        <section className="lg:col-span-3">
          <SectionTitle
            title="Aguardando sua chancela"
            hint="Propostas da IA que precisam de decisão clínica."
            action={
              queue.length > 0 ? (
                <Link
                  href="/pro/revisao"
                  className="flex items-center gap-1 text-sm font-semibold text-brand-text hover:underline"
                >
                  Ver as {queue.length}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              ) : undefined
            }
          />

          {queue.length === 0 ? (
            <Card>
              <EmptyState
                icon={Inbox}
                title="Fila vazia"
                description="Nenhuma proposta da IA aguardando decisão no momento."
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {queue.slice(0, 3).map((c) => (
                <Link key={c.id} href={`/pro/revisao/${c.id}`} className="tap block">
                  <Card className="transition-colors hover:border-line-strong">
                    <div className="flex items-start gap-3">
                      <Avatar name={c.patient} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-bold">{c.patient}</h3>
                          <Badge tone={c.urgency === 'alta' ? 'danger' : 'warn'}>
                            {c.urgency === 'alta' ? 'Prioridade' : 'Revisão'}
                          </Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-muted">{c.trigger}</p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs font-medium text-subtle">
                          <span className="rounded-md bg-surface-2 px-1.5 py-0.5">
                            {c.module}
                          </span>
                          <span className="flex items-center gap-1 text-brand-text">
                            <BrainCircuit className="h-3 w-3" aria-hidden />
                            {c.confidence}% de confiança
                          </span>
                          <span>{c.age}</span>
                        </div>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-subtle" aria-hidden />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ------------------------------------------------ atividade */}
        <section className="lg:col-span-2">
          <SectionTitle title="Atividade da clínica" />
          {activity.length === 0 ? (
            <Card>
              <EmptyState
                icon={Inbox}
                title="Sem atividade recente"
                description="Check-ins, treinos e propostas aparecem aqui."
              />
            </Card>
          ) : (
            <Card inset className="divide-y divide-line">
              {activity.map((log, i) => (
                <div key={`${log.text}-${i}`} className="flex gap-3 px-4 py-3.5">
                  <span
                    className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', toneDot[log.tone])}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">{log.text}</p>
                    <p className="mt-1 text-2xs font-medium text-subtle">
                      {log.who} · {log.when}
                    </p>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </section>
      </div>

      {/* Ações principais no rodapé do mobile */}
      <div className="flex gap-3 sm:hidden">
        <Button variant="secondary" icon={FileText} className="flex-1">
          Relatório
        </Button>
        <Button icon={UserPlus} className="flex-1">
          Novo paciente
        </Button>
      </div>
    </div>
  );
}

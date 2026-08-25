'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Apple,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  Dumbbell,
  FileText,
  MessageSquare,
  Pencil,
  Phone,
  Target,
} from 'lucide-react';
import { Avatar, Badge, Button, Card, Progress, SectionTitle } from '@/components/ui';
import { Tabs } from '@/components/ui/interactive';
import { BarChart, LineChart } from '@/components/charts';
import {
  adherenceSeries,
  examMarkers,
  patientTimeline,
  weightSeries,
  type Patient,
} from '@/lib/data';
import { cn } from '@/lib/utils';

type Tab = 'resumo' | 'nutricao' | 'treino' | 'exames';

const examStatus = {
  ok: { label: 'Normal', icon: CheckCircle2, tone: 'success' as const },
  atencao: { label: 'Atenção', icon: AlertTriangle, tone: 'warn' as const },
  alterado: { label: 'Alterado', icon: AlertTriangle, tone: 'danger' as const },
};

const toneDot: Record<string, string> = {
  success: 'bg-success',
  brand: 'bg-brand',
  warn: 'bg-warn',
  danger: 'bg-danger',
  neutral: 'bg-subtle',
};

const weekLabels = Array.from({ length: weightSeries.length }, (_, i) => `S${i + 1}`);
const adherenceLabels = Array.from({ length: adherenceSeries.length }, (_, i) => `S${i + 1}`);

export function PacienteDetalhe({ patient }: { patient: Patient }) {
  const [tab, setTab] = useState<Tab>('resumo');

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------ cabeçalho */}
      <Card>
        <div className="flex items-start gap-3">
          <Avatar name={patient.name} size="lg" online={patient.online} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">
              {patient.name}
            </h1>
            <p className="truncate text-sm text-muted">{patient.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone="brand">{patient.plan}</Badge>
              <Badge tone={patient.tone}>{patient.status}</Badge>
            </div>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-2 border-t border-line pt-4 sm:grid-cols-4">
          {[
            { icon: Target, label: 'Objetivo', value: patient.goal },
            { icon: Activity, label: 'Peso atual', value: `${patient.weight} kg` },
            { icon: CalendarDays, label: 'Último check-in', value: patient.lastCheckin },
            { icon: BrainCircuit, label: 'Adesão', value: `${patient.adherence}%` },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-surface-2 px-3 py-2.5">
              <dt className="flex items-center gap-1.5 text-2xs font-medium text-subtle">
                <s.icon className="h-3 w-3" aria-hidden />
                {s.label}
              </dt>
              <dd className="mt-1 truncate text-sm font-bold">{s.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button size="sm" icon={MessageSquare}>
            Mensagem
          </Button>
          <Button variant="secondary" size="sm" icon={Pencil}>
            Protocolo
          </Button>
          <Button variant="secondary" size="sm" icon={FileText}>
            Prontuário
          </Button>
          <Button variant="secondary" size="sm" icon={Phone}>
            Ligar
          </Button>
        </div>
      </Card>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'resumo', label: 'Resumo' },
          { value: 'nutricao', label: 'Nutrição' },
          { value: 'treino', label: 'Treino' },
          { value: 'exames', label: 'Exames' },
        ]}
      />

      {/* ------------------------------------------------ resumo */}
      {tab === 'resumo' && (
        <div className="animate-fade-in space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="text-sm font-semibold">Peso corporal</h2>
              <p className="mt-0.5 text-sm text-muted">Últimas 12 semanas.</p>
              <LineChart
                className="mt-4"
                data={weightSeries}
                labels={weekLabels}
                format={{ decimals: 1, suffix: ' kg' }}
                height={160}
                caption={`Peso corporal de ${patient.name} nas últimas 12 semanas.`}
              />
            </Card>

            <Card>
              <h2 className="text-sm font-semibold">Adesão ao protocolo</h2>
              <p className="mt-0.5 text-sm text-muted">Percentual por semana.</p>
              <BarChart
                className="mt-4"
                data={adherenceSeries}
                labels={adherenceLabels}
                format={{ suffix: '%' }}
                height={160}
                caption={`Adesão semanal de ${patient.name} ao protocolo.`}
              />
            </Card>
          </div>

          <section>
            <SectionTitle title="Linha do tempo" />
            <Card inset className="divide-y divide-line">
              {patientTimeline.map((item) => (
                <div key={item.title} className="flex gap-3 px-4 py-3.5">
                  <span
                    className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', toneDot[item.tone])}
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
        </div>
      )}

      {/* ------------------------------------------------ nutrição */}
      {tab === 'nutricao' && (
        <div className="animate-fade-in space-y-4">
          <Card>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-muted">
                <Apple className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold">Protocolo nutricional ativo</h2>
                <p className="text-sm text-muted">Hipertrofia limpa · 2.400 kcal</p>
              </div>
              <Badge tone="success">Ativo</Badge>
            </div>

            <div className="mt-5 space-y-3">
              {[
                { label: 'Proteínas', current: 160, target: 160, tone: 'cat1' as const },
                { label: 'Carboidratos', current: 280, target: 280, tone: 'cat2' as const },
                { label: 'Gorduras', current: 70, target: 70, tone: 'cat3' as const },
              ].map((m) => (
                <div key={m.label}>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-sm font-medium">{m.label}</span>
                    <span className="text-sm font-semibold tabular-nums">{m.target} g</span>
                  </div>
                  <Progress value={100} tone={m.tone} label={m.label} />
                </div>
              ))}
            </div>
          </Card>

          <Card className="flex items-start gap-3 border-brand-line bg-brand-soft">
            <BrainCircuit className="mt-0.5 h-4 w-4 shrink-0 text-brand-text" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Há uma proposta de ajuste pendente</p>
              <p className="mt-0.5 text-sm text-muted">
                A IA sugeriu +200 kcal no almoço após a queda de ferritina.
              </p>
            </div>
            <Link
              href="/pro/revisao/r1"
              className="tap shrink-0 self-center text-sm font-semibold text-brand-text hover:underline"
            >
              Revisar
            </Link>
          </Card>
        </div>
      )}

      {/* ------------------------------------------------ treino */}
      {tab === 'treino' && (
        <div className="animate-fade-in space-y-4">
          <Card>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-muted">
                <Dumbbell className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold">Periodização atual</h2>
                <p className="text-sm text-muted">Ondulatória · semana 9 de 12</p>
              </div>
              <Badge tone="brand">ABCD</Badge>
            </div>

            <div className="mt-5 space-y-2">
              {[
                { letter: 'A', focus: 'Membros inferiores', volume: '18 séries', done: '9/12' },
                { letter: 'B', focus: 'Peito e tríceps', volume: '20 séries', done: '9/12' },
                { letter: 'C', focus: 'Costas e bíceps', volume: '20 séries', done: '8/12' },
                { letter: 'D', focus: 'Ombros e core', volume: '16 séries', done: '8/12' },
              ].map((f) => (
                <div
                  key={f.letter}
                  className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-sm font-bold">
                    {f.letter}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{f.focus}</p>
                    <p className="text-sm text-muted">{f.volume}</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-muted">
                    {f.done}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ------------------------------------------------ exames */}
      {tab === 'exames' && (
        <div className="animate-fade-in">
          <Card inset className="divide-y divide-line overflow-hidden">
            {examMarkers.map((m) => {
              const status = examStatus[m.status];
              return (
                <div key={m.name} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{m.name}</p>
                    <p className="mt-0.5 text-sm text-muted">Referência: {m.ref}</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums">{m.value}</span>
                  <Badge tone={status.tone} icon={status.icon} className="shrink-0">
                    {status.label}
                  </Badge>
                </div>
              );
            })}
          </Card>
        </div>
      )}
    </div>
  );
}

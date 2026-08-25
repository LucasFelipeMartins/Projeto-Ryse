'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Download,
  FileText,
  Minus,
  TrendingDown,
} from 'lucide-react';
import { Badge, Button, Card, PageIntro, SectionTitle } from '@/components/ui';
import { Segmented, Sheet } from '@/components/ui/interactive';
import { BarChart, LineChart } from '@/components/charts';
import {
  adherenceSeries,
  examMarkers,
  measurements,
  weightSeries,
  type ExamMarker,
} from '@/lib/data';
import { cn } from '@/lib/utils';

/* Estado do exame: sempre ícone + rótulo — nunca só a cor. */
const examStatus = {
  ok: { label: 'Normal', icon: CheckCircle2, tone: 'success' as const },
  atencao: { label: 'Atenção', icon: AlertTriangle, tone: 'warn' as const },
  alterado: { label: 'Alterado', icon: AlertTriangle, tone: 'danger' as const },
};

const trendIcon = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus };

const weekLabels = Array.from({ length: weightSeries.length }, (_, i) => `S${i + 1}`);
const adherenceLabels = Array.from(
  { length: adherenceSeries.length },
  (_, i) => `S${i + 1}`,
);

export function ProgressoView() {
  const [range, setRange] = useState<'12s' | '6m' | '1a'>('12s');
  const [marker, setMarker] = useState<ExamMarker | null>(null);

  const first = weightSeries[0];
  const last = weightSeries[weightSeries.length - 1];
  const diff = last - first;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Desde março de 2025"
        title="Progresso"
        description="Sua evolução física e os marcadores de sangue em um só lugar."
        action={
          <Button variant="secondary" size="sm" icon={Download} className="hidden sm:inline-flex">
            Exportar
          </Button>
        }
      />

      {/* ------------------------------------------------ medidas */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {measurements.map((m) => (
          <Card key={m.label}>
            <p className="text-sm font-medium text-muted">{m.label}</p>
            <p className="mt-1.5 text-xl font-bold tabular-nums tracking-tight sm:text-2xl">
              {m.value}
            </p>
            <p
              className={cn(
                'mt-1 flex items-center gap-1 text-sm font-semibold',
                m.good ? 'text-success' : 'text-danger',
              )}
            >
              <TrendingDown className="h-3.5 w-3.5" aria-hidden />
              {m.delta}
            </p>
          </Card>
        ))}
      </div>

      {/* ------------------------------------------------ peso corporal */}
      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {/* Série única: o título nomeia o dado, então não há legenda. */}
            <h2 className="text-base font-semibold tracking-tight">Peso corporal</h2>
            <p className="mt-0.5 text-sm text-muted">
              <strong className="tabular-nums text-fg">
                {last.toFixed(1).replace('.', ',')} kg
              </strong>{' '}
              hoje ·{' '}
              <span className="font-semibold text-success tabular-nums">
                {diff.toFixed(1).replace('.', ',')} kg
              </span>{' '}
              no período
            </p>
          </div>
          <Segmented
            className="w-auto"
            options={[
              { value: '12s', label: '12 sem' },
              { value: '6m', label: '6 meses' },
              { value: '1a', label: '1 ano' },
            ]}
            value={range}
            onChange={setRange}
          />
        </div>

        <LineChart
          data={weightSeries}
          labels={weekLabels}
          format={{ decimals: 1, suffix: ' kg' }}
          height={180}
          color="brand"
          caption={`Peso corporal ao longo de ${weightSeries.length} semanas, de ${first
            .toFixed(1)
            .replace('.', ',')} kg a ${last.toFixed(1).replace('.', ',')} kg.`}
        />
      </Card>

      {/* ------------------------------------------------ adesão */}
      <Card>
        <div className="mb-4">
          <h2 className="text-base font-semibold tracking-tight">Adesão ao protocolo</h2>
          <p className="mt-0.5 text-sm text-muted">
            Percentual das refeições e treinos cumpridos por semana.
          </p>
        </div>

        <BarChart
          data={adherenceSeries}
          labels={adherenceLabels}
          format={{ suffix: '%' }}
          height={160}
          color="brand"
          caption={`Adesão semanal ao protocolo, variando de ${Math.min(
            ...adherenceSeries,
          )}% a ${Math.max(...adherenceSeries)}%.`}
        />
      </Card>

      {/* ------------------------------------------------ exames */}
      <section>
        <SectionTitle
          title="Marcadores de sangue"
          hint="Coleta de 24 de outubro · Laboratório Fleury"
          action={
            <Button variant="ghost" size="sm" icon={FileText}>
              PDF
            </Button>
          }
        />

        <Card inset className="divide-y divide-line overflow-hidden">
          {examMarkers.map((m) => {
            const status = examStatus[m.status];
            const Trend = trendIcon[m.trend];
            return (
              <button
                key={m.name}
                onClick={() => setMarker(m)}
                className="tap flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{m.name}</span>
                  <span className="mt-0.5 block text-sm text-muted">
                    Referência: {m.ref}
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span className="block text-sm font-bold tabular-nums">{m.value}</span>
                  <span className="mt-0.5 flex items-center justify-end gap-0.5 text-sm text-muted">
                    <Trend className="h-3 w-3" aria-hidden />
                    <span className="tabular-nums">{m.delta}</span>
                  </span>
                </span>

                <Badge tone={status.tone} icon={status.icon} className="shrink-0">
                  {status.label}
                </Badge>
              </button>
            );
          })}
        </Card>
      </section>

      {/* Alternativa textual à leitura visual dos gráficos. */}
      <details className="rounded-2xl border border-line bg-surface p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          Ver os dados dos gráficos em tabela
        </summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <caption className="sr-only">
              Peso corporal e adesão ao protocolo, por semana.
            </caption>
            <thead>
              <tr className="border-b border-line text-2xs font-bold uppercase tracking-wider text-subtle">
                <th scope="col" className="py-2 pr-3">Semana</th>
                <th scope="col" className="py-2 pr-3">Peso (kg)</th>
                <th scope="col" className="py-2">Adesão (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {weightSeries.map((w, i) => (
                <tr key={i}>
                  <th scope="row" className="py-2 pr-3 font-medium">S{i + 1}</th>
                  <td className="py-2 pr-3 tabular-nums text-muted">
                    {w.toFixed(1).replace('.', ',')}
                  </td>
                  <td className="py-2 tabular-nums text-muted">
                    {adherenceSeries[i] ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {/* ------------------------------------------------ folha do marcador */}
      <Sheet
        open={marker !== null}
        onClose={() => setMarker(null)}
        title={marker?.name ?? ''}
        description={marker ? `Referência ${marker.ref}` : undefined}
      >
        {marker && (
          <div className="pb-4">
            <div className="mb-5 flex items-end justify-between gap-4 rounded-2xl bg-surface-2 p-4">
              <div>
                <p className="text-2xs font-medium text-subtle">Resultado atual</p>
                <p className="mt-1 text-3xl font-bold tabular-nums">{marker.value}</p>
              </div>
              <Badge
                tone={examStatus[marker.status].tone}
                icon={examStatus[marker.status].icon}
              >
                {examStatus[marker.status].label}
              </Badge>
            </div>

            <h3 className="mb-2 text-sm font-semibold">O que isso significa</h3>
            <p className="text-sm leading-relaxed text-muted">
              {marker.status === 'ok'
                ? 'O valor está dentro da faixa de referência. Nenhuma ação é necessária neste momento.'
                : marker.status === 'atencao'
                  ? 'O valor está no limite inferior da faixa. A IA sinalizou o caso e seu médico já recebeu a proposta de ajuste nutricional.'
                  : 'O valor está fora da faixa de referência. Seu médico foi notificado e vai avaliar a conduta no próximo retorno.'}
            </p>

            <div className="mt-5 rounded-xl border border-line p-3.5">
              <p className="text-2xs font-bold uppercase tracking-wider text-subtle">
                Variação desde a última coleta
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums">
                {marker.delta === '0' ? 'Sem variação' : `${marker.delta} em 90 dias`}
              </p>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

import { Download, Receipt } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  PageIntro,
  SectionTitle,
  Stat,
} from '@/components/ui';
import { BarChart, StackedBar } from '@/components/charts';
import { financeKpis, planMix, revenueSeries, transactions } from '@/lib/data';
import { brl } from '@/lib/utils';

export const metadata = { title: 'Faturamento' };

const months = revenueSeries.map((r) => r.month);
const values = revenueSeries.map((r) => r.value);

export default function FinanceiroPage() {
  return (
    <div className="space-y-6">
      <PageIntro
        title="Faturamento"
        description="Receita recorrente e controle de pagamentos."
        action={
          <div className="hidden gap-2 sm:flex">
            <Button variant="secondary" icon={Download}>
              Exportar
            </Button>
            <Button icon={Receipt}>Nova cobrança</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {financeKpis.map((kpi) => (
          <Stat
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            delta={kpi.delta}
            up={kpi.up}
            hint="vs. mês anterior"
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Série única de receita — o título nomeia o dado, sem legenda. */}
        <Card className="lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-base font-semibold tracking-tight">Receita mensal</h2>
            <p className="mt-0.5 text-sm text-muted">
              Últimos 8 meses, em milhares de reais.
            </p>
          </div>
          <BarChart
            data={values}
            labels={months}
            format={{ prefix: 'R$ ', decimals: 1, suffix: ' mil' }}
            height={200}
            color="brand"
            caption={`Receita mensal de março a outubro, subindo de R$ ${values[0]} mil para R$ ${
              values[values.length - 1]
            } mil.`}
          />
        </Card>

        {/* Três categorias: legenda + rótulo direto acompanham cada fatia. */}
        <Card>
          <div className="mb-5">
            <h2 className="text-base font-semibold tracking-tight">
              Distribuição de planos
            </h2>
            <p className="mt-0.5 text-sm text-muted">842 assinaturas ativas.</p>
          </div>
          <StackedBar
            segments={planMix.map((p) => ({
              name: p.name,
              value: p.count,
              percent: p.percent,
            }))}
          />
        </Card>
      </div>

      {/* ------------------------------------------------ transações */}
      <section>
        <SectionTitle
          title="Últimas transações"
          action={
            <button className="text-sm font-semibold text-brand-text hover:underline">
              Ver todas
            </button>
          }
        />

        {/* MOBILE: lista */}
        <Card inset className="divide-y divide-line lg:hidden">
          {transactions.map((t) => (
            <div key={`${t.name}-${t.date}`} className="flex items-center gap-3 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{t.name}</p>
                <p className="mt-0.5 truncate text-sm text-muted">
                  {t.plan} · {t.date}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold tabular-nums">{brl(t.amount)}</p>
                <Badge tone={t.tone} className="mt-1">
                  {t.status}
                </Badge>
              </div>
            </div>
          ))}
        </Card>

        {/* DESKTOP: tabela */}
        <Card inset className="hidden overflow-hidden lg:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">
                Últimas transações com paciente, plano, valor, status e data.
              </caption>
              <thead>
                <tr className="border-b border-line bg-surface-2 text-2xs font-bold uppercase tracking-wider text-subtle">
                  <th scope="col" className="px-4 py-3">Paciente</th>
                  <th scope="col" className="px-4 py-3">Plano</th>
                  <th scope="col" className="px-4 py-3">Valor</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3 text-right">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {transactions.map((t) => (
                  <tr
                    key={`${t.name}-${t.date}`}
                    className="transition-colors hover:bg-surface-2"
                  >
                    <th scope="row" className="px-4 py-3 font-semibold">
                      {t.name}
                    </th>
                    <td className="px-4 py-3 text-muted">{t.plan}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums">
                      {brl(t.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={t.tone}>{t.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-muted">{t.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <div className="flex gap-3 sm:hidden">
        <Button variant="secondary" icon={Download} className="flex-1">
          Exportar
        </Button>
        <Button icon={Receipt} className="flex-1">
          Nova cobrança
        </Button>
      </div>
    </div>
  );
}

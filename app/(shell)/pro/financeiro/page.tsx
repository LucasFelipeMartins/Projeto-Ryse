import { Download, Receipt, Wallet } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageIntro,
  SectionTitle,
  Stat,
} from '@/components/ui';
import { BarChart, StackedBar } from '@/components/charts';
import { getFinance } from '@/lib/queries/pro';
import { requireProfessional } from '@/lib/supabase/server';
import { centsToBRL } from '@/lib/utils';

export const metadata = { title: 'Faturamento' };

export default async function FinanceiroPage() {
  const pro = await requireProfessional();
  const { kpis, planMix, revenueSeries, transactions } = await getFinance(pro.id);

  const months = revenueSeries.map((r) => r.month);
  const values = revenueSeries.map((r) => r.value);
  const hasRevenue = values.some((v) => v > 0);

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
        <Stat label="MRR" value={centsToBRL(kpis.mrrCents)} hint="assinaturas ativas" />
        <Stat label="Assinaturas ativas" value={String(kpis.activeSubs)} />
        <Stat label="Ticket médio" value={centsToBRL(kpis.avgTicketCents)} />
        <Stat
          label="Falha de cobrança"
          value={`${kpis.failureRate.toString().replace('.', ',')}%`}
          delta={kpis.failureRate > 5 ? 'Acima do esperado' : 'Sob controle'}
          up={kpis.failureRate <= 5}
        />
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

          {hasRevenue ? (
            <BarChart
              data={values}
              labels={months}
              format={{ prefix: 'R$ ', decimals: 1, suffix: ' mil' }}
              height={200}
              color="brand"
              caption={`Receita mensal paga, de R$ ${values[0]} mil a R$ ${
                values[values.length - 1]
              } mil.`}
            />
          ) : (
            <EmptyState
              icon={Wallet}
              title="Nenhuma cobrança registrada"
              description="A curva de receita aparece após a primeira transação paga."
            />
          )}
        </Card>

        {/* Três categorias: legenda + rótulo direto acompanham cada fatia. */}
        <Card>
          <div className="mb-5">
            <h2 className="text-base font-semibold tracking-tight">
              Distribuição de planos
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {kpis.activeSubs} assinaturas ativas.
            </p>
          </div>

          {planMix.length > 0 ? (
            <StackedBar segments={planMix} />
          ) : (
            <EmptyState icon={Wallet} title="Sem assinaturas ativas" />
          )}
        </Card>
      </div>

      {/* ------------------------------------------------ transações */}
      <section>
        <SectionTitle title="Últimas transações" />

        {transactions.length === 0 ? (
          <Card>
            <EmptyState
              icon={Receipt}
              title="Nenhuma transação"
              description="As cobranças dos seus pacientes aparecem aqui."
            />
          </Card>
        ) : (
          <>
            {/* MOBILE: lista */}
            <Card inset className="divide-y divide-line lg:hidden">
              {transactions.map((t, i) => (
                <div key={`${t.name}-${i}`} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{t.name}</p>
                    <p className="mt-0.5 truncate text-sm text-muted">{t.date}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums">
                      {centsToBRL(t.amountCents)}
                    </p>
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
                <table className="w-full min-w-[560px] text-left text-sm">
                  <caption className="sr-only">
                    Últimas transações com paciente, valor, status e data.
                  </caption>
                  <thead>
                    <tr className="border-b border-line bg-surface-2 text-2xs font-bold uppercase tracking-wider text-subtle">
                      <th scope="col" className="px-4 py-3">Paciente</th>
                      <th scope="col" className="px-4 py-3">Valor</th>
                      <th scope="col" className="px-4 py-3">Status</th>
                      <th scope="col" className="px-4 py-3 text-right">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {transactions.map((t, i) => (
                      <tr key={`${t.name}-${i}`} className="transition-colors hover:bg-surface-2">
                        <th scope="row" className="px-4 py-3 font-semibold">
                          {t.name}
                        </th>
                        <td className="px-4 py-3 font-semibold tabular-nums">
                          {centsToBRL(t.amountCents)}
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
          </>
        )}
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

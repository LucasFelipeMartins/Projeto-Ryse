'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  Search,
  SlidersHorizontal,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  PageIntro,
  Progress,
} from '@/components/ui';
import { ChipRow, Input, Sheet } from '@/components/ui/interactive';
import type { PatientRowView } from '@/lib/queries/pro';
import { cn } from '@/lib/utils';

const FILTERS = [
  { value: 'todos', label: 'Todos' },
  { value: 'revisao', label: 'Em revisão' },
  { value: 'alerta', label: 'Com alerta' },
  { value: 'estavel', label: 'Estáveis' },
] as const;

type Filter = (typeof FILTERS)[number]['value'];

const statusIcon = {
  warn: BrainCircuit,
  danger: AlertTriangle,
  success: CheckCircle2,
  neutral: FileText,
  brand: BrainCircuit,
} as const;

function matchesFilter(p: PatientRowView, f: Filter) {
  if (f === 'todos') return true;
  if (f === 'revisao') return p.tone === 'warn';
  if (f === 'alerta') return p.tone === 'danger';
  return p.tone === 'success';
}

export function PacientesView({ patients }: { patients: PatientRowView[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');
  const [sheetOpen, setSheetOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return patients.filter(
      (p) =>
        matchesFilter(p, filter) &&
        (q === '' ||
          p.name.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          p.goal.toLowerCase().includes(q)),
    );
  }, [patients, query, filter]);

  const counts = useMemo(
    () =>
      FILTERS.reduce<Record<string, number>>((acc, f) => {
        acc[f.value] = patients.filter((p) => matchesFilter(p, f.value)).length;
        return acc;
      }, {}),
    [patients],
  );

  return (
    <div className="space-y-5">
      <PageIntro
        title="Pacientes"
        description={`${patients.length} ativos na sua base.`}
        action={
          <div className="hidden gap-2 sm:flex">
            <Button variant="secondary" icon={Download}>
              Exportar
            </Button>
            <Button icon={UserPlus}>Adicionar</Button>
          </div>
        }
      />

      <div className="flex gap-2">
        <Input
          icon={Search}
          type="search"
          placeholder="Buscar nome, e-mail ou objetivo"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1"
        />
        <Button
          variant="secondary"
          onClick={() => setSheetOpen(true)}
          aria-label="Mais filtros"
          className="w-11 px-0 sm:w-auto sm:px-4"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Filtros</span>
        </Button>
      </div>

      <ChipRow
        options={FILTERS.map((f) => ({ ...f, count: counts[f.value] }))}
        value={filter}
        onChange={setFilter}
      />

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="Nenhum paciente encontrado"
            description="Ajuste a busca ou troque o filtro selecionado."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery('');
                  setFilter('todos');
                }}
              >
                Limpar filtros
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {/* ---------------------------------------- MOBILE: lista de cards */}
          <div className="space-y-3 lg:hidden">
            {filtered.map((p) => {
              const Icon = statusIcon[p.tone];
              return (
                <Link key={p.id} href={`/pro/pacientes/${p.id}`} className="tap block">
                  <Card className="transition-colors hover:border-line-strong">
                    <div className="flex items-start gap-3">
                      <Avatar name={p.name} src={p.avatarUrl} size="md" />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-bold">{p.name}</h3>
                        <p className="mt-0.5 truncate text-sm text-muted">
                          {p.plan} · {p.goal}
                        </p>
                        <Badge tone={p.tone} icon={Icon} className="mt-2">
                          {p.status}
                        </Badge>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-subtle" aria-hidden />
                    </div>

                    <div className="mt-4 border-t border-line pt-3.5">
                      <div className="mb-1.5 flex items-baseline justify-between">
                        <span className="text-2xs font-medium text-subtle">
                          Adesão ao protocolo
                        </span>
                        <span className="text-sm font-bold tabular-nums">
                          {p.adherence}%
                        </span>
                      </div>
                      <Progress
                        value={p.adherence}
                        tone={p.adherence >= 80 ? 'success' : 'brand'}
                        label={`Adesão de ${p.name}: ${p.adherence}%`}
                      />
                      <p className="mt-2 text-2xs text-subtle">
                        Último check-in {p.lastCheckin}
                      </p>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* ---------------------------------------- DESKTOP: tabela */}
          <Card inset className="hidden overflow-hidden lg:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <caption className="sr-only">
                  Pacientes ativos com plano, objetivo, adesão e status clínico.
                </caption>
                <thead>
                  <tr className="border-b border-line bg-surface-2 text-2xs font-bold uppercase tracking-wider text-subtle">
                    <th scope="col" className="px-4 py-3">Paciente</th>
                    <th scope="col" className="px-4 py-3">Plano</th>
                    <th scope="col" className="px-4 py-3">Objetivo</th>
                    <th scope="col" className="px-4 py-3 w-44">Adesão</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3 text-right">Check-in</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map((p) => {
                    const Icon = statusIcon[p.tone];
                    return (
                      <tr key={p.id} className="group transition-colors hover:bg-surface-2">
                        <th scope="row" className="px-4 py-3 font-normal">
                          <Link
                            href={`/pro/pacientes/${p.id}`}
                            className="flex items-center gap-3"
                          >
                            <Avatar name={p.name} src={p.avatarUrl} size="sm" />
                            <span className="min-w-0">
                              <span className="block truncate font-semibold group-hover:text-brand-text">
                                {p.name}
                              </span>
                              <span className="block truncate text-sm text-muted">
                                {p.email}
                              </span>
                            </span>
                          </Link>
                        </th>
                        <td className="px-4 py-3 text-muted">{p.plan}</td>
                        <td className="px-4 py-3 text-muted">{p.goal}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <Progress
                              value={p.adherence}
                              tone={p.adherence >= 80 ? 'success' : 'brand'}
                              className="w-20"
                              label={`Adesão de ${p.name}`}
                            />
                            <span
                              className={cn(
                                'text-sm font-bold tabular-nums',
                                p.adherence < 70 && 'text-danger',
                              )}
                            >
                              {p.adherence}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={p.tone} icon={Icon}>
                            {p.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right text-muted">{p.lastCheckin}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-line bg-surface-2 px-4 py-3 text-sm text-muted">
              <span>
                Mostrando {filtered.length} de {patients.length}
              </span>
              <div className="flex gap-1">
                <button
                  disabled
                  className="rounded-lg border border-line px-2.5 py-1 disabled:opacity-40"
                >
                  Anterior
                </button>
                <button className="rounded-lg bg-brand px-2.5 py-1 font-semibold text-brand-on">
                  1
                </button>
                <button className="rounded-lg border border-line px-2.5 py-1 hover:bg-surface">
                  2
                </button>
                <button className="rounded-lg border border-line px-2.5 py-1 hover:bg-surface">
                  Próxima
                </button>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Ações principais no rodapé do mobile */}
      <div className="flex gap-3 sm:hidden">
        <Button variant="secondary" icon={Download} className="flex-1">
          Exportar
        </Button>
        <Button icon={UserPlus} className="flex-1">
          Adicionar
        </Button>
      </div>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filtros"
        description="Refine a lista por plano, objetivo e engajamento."
        footer={
          <Button block onClick={() => setSheetOpen(false)}>
            Aplicar filtros
          </Button>
        }
      >
        <div className="space-y-5 pb-4">
          {[
            { title: 'Plano', options: ['Ryse Completo', 'Ryse Nutrição', 'Ryse Treino'] },
            {
              title: 'Objetivo',
              options: ['Emagrecimento', 'Hipertrofia', 'Performance', 'Longevidade'],
            },
            { title: 'Adesão', options: ['Acima de 90%', '70% a 90%', 'Abaixo de 70%'] },
          ].map((group) => (
            <fieldset key={group.title}>
              <legend className="mb-2 text-sm font-semibold">{group.title}</legend>
              <div className="flex flex-wrap gap-2">
                {group.options.map((o) => (
                  <button
                    key={o}
                    className="tap rounded-full border border-line px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:border-brand hover:text-fg"
                  >
                    {o}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

'use client';

import { useState } from 'react';
import {
  Activity,
  Apple,
  Copy,
  Dumbbell,
  Lock,
  Pencil,
  Plus,
  Unlock,
  Users,
} from 'lucide-react';
import { Badge, Button, Card, EmptyState, PageIntro } from '@/components/ui';
import { Tabs } from '@/components/ui/interactive';
import type { ProtocolKind } from '@/lib/supabase/types';

type Tab = 'todos' | 'nutricao' | 'treino' | 'exames';

const typeMeta = {
  nutricao: { label: 'Nutrição', icon: Apple },
  treino: { label: 'Treino', icon: Dumbbell },
  exames: { label: 'Exames', icon: Activity },
} as const;

type ProtocolView = {
  id: string;
  title: string;
  kind: ProtocolKind;
  aiEnabled: boolean;
  uses: number;
};

export function ProtocolosView({ protocols }: { protocols: ProtocolView[] }) {
  const [tab, setTab] = useState<Tab>('todos');

  const filtered =
    tab === 'todos' ? protocols : protocols.filter((p) => p.kind === tab);

  return (
    <div className="space-y-5">
      <PageIntro
        title="Protocolos base"
        description="Os moldes que alimentam as decisões da inteligência artificial."
        action={
          <Button icon={Plus} className="hidden sm:inline-flex">
            Novo protocolo
          </Button>
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'todos', label: 'Todos' },
          { value: 'nutricao', label: 'Nutricionais' },
          { value: 'treino', label: 'Fichas de treino' },
          { value: 'exames', label: 'Bateria de exames' },
        ]}
      />

      {filtered.length === 0 && (
        <Card>
          <EmptyState
            icon={Plus}
            title="Nenhum protocolo aqui"
            description="Crie um molde para que a IA tenha uma base sobre a qual propor ajustes."
          />
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((p) => {
          const meta = typeMeta[p.kind];
          return (
            <Card key={p.id} className="group flex flex-col">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
                  <meta.icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <Badge tone="neutral">{meta.label}</Badge>
                  <h2 className="mt-1.5 text-sm font-bold leading-snug">{p.title}</h2>
                </div>

                {/* No mobile as ações ficam sempre visíveis (não há hover). */}
                <div className="flex shrink-0 gap-1 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                  <button
                    aria-label={`Duplicar ${p.title}`}
                    className="tap flex h-8 w-8 items-center justify-center rounded-lg border border-line text-subtle hover:text-fg"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    aria-label={`Editar ${p.title}`}
                    className="tap flex h-8 w-8 items-center justify-center rounded-lg border border-line text-subtle hover:text-fg"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </div>

              <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3.5 text-sm text-muted">
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" aria-hidden />
                  <span className="tabular-nums">{p.uses}</span> usos
                </span>

                <span className="flex items-center gap-2">
                  {/* Ícone + rótulo: o cadeado nunca carrega o sentido sozinho. */}
                  <span
                    className={
                      'flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-semibold ' +
                      (p.aiEnabled
                        ? 'bg-brand-soft text-brand-text'
                        : 'bg-surface-2 text-muted')
                    }
                  >
                    {p.aiEnabled ? (
                      <Unlock className="h-3 w-3" aria-hidden />
                    ) : (
                      <Lock className="h-3 w-3" aria-hidden />
                    )}
                    {p.aiEnabled ? 'IA pode ajustar' : 'Rígido'}
                  </span>
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      <Button icon={Plus} block className="sm:hidden">
        Novo protocolo
      </Button>
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import {
  Activity,
  AlertCircle,
  Apple,
  Copy,
  Dumbbell,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Trash2,
  Unlock,
  Users,
} from 'lucide-react';
import { Badge, Button, Card, EmptyState, PageIntro } from '@/components/ui';
import { Field, Input, Select, Sheet, Switch, Tabs, Textarea } from '@/components/ui/interactive';
import {
  createProtocol,
  deleteProtocol,
  duplicateProtocol,
  toggleProtocolAi,
  updateProtocol,
  type ProtocolInput,
} from '@/lib/actions/protocols';
import type { ProtocolKind } from '@/lib/supabase/types';

type Tab = 'todos' | ProtocolKind;

const typeMeta = {
  nutricao: { label: 'Nutrição', icon: Apple },
  treino: { label: 'Treino', icon: Dumbbell },
  exames: { label: 'Exames', icon: Activity },
} as const;

const ITEM_PLACEHOLDER: Record<ProtocolKind, string> = {
  nutricao: 'Café da manhã: 3 ovos, 60 g de aveia\nAlmoço: 150 g de patinho, 100 g de arroz',
  treino: 'Agachamento livre 4 × 6-8\nLeg press 4 × 10-12',
  exames: 'Hemograma completo\nFerritina\nVitamina D',
};

export type ProtocolView = {
  id: string;
  title: string;
  kind: ProtocolKind;
  aiEnabled: boolean;
  uses: number;
  description: string;
  items: string[];
};

export function ProtocolosView({ protocols }: { protocols: ProtocolView[] }) {
  const [tab, setTab] = useState<Tab>('todos');
  const [editing, setEditing] = useState<ProtocolView | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();

  const filtered = tab === 'todos' ? protocols : protocols.filter((p) => p.kind === tab);

  const run = (fn: () => Promise<{ ok: boolean }>) => startTransition(() => void fn());

  return (
    <div className="space-y-5">
      <PageIntro
        title="Protocolos base"
        description="Os moldes que alimentam as decisões da inteligência artificial."
        action={
          <Button icon={Plus} className="hidden sm:inline-flex" onClick={() => setCreating(true)}>
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

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Plus}
            title="Nenhum protocolo aqui"
            description="Crie um molde para que a IA tenha uma base sobre a qual propor ajustes."
            action={
              <Button icon={Plus} onClick={() => setCreating(true)}>
                Criar protocolo
              </Button>
            }
          />
        </Card>
      ) : (
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
                      disabled={pending}
                      onClick={() => run(() => duplicateProtocol(p.id))}
                      className="tap flex h-8 w-8 items-center justify-center rounded-lg border border-line text-subtle hover:text-fg disabled:opacity-50"
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      aria-label={`Editar ${p.title}`}
                      onClick={() => setEditing(p)}
                      className="tap flex h-8 w-8 items-center justify-center rounded-lg border border-line text-subtle hover:text-fg"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </div>

                {p.description && (
                  <p className="mt-3 line-clamp-2 text-sm text-muted">{p.description}</p>
                )}

                {p.items.length > 0 && (
                  <p className="mt-2 text-2xs font-medium text-subtle">
                    {p.items.length} {p.items.length === 1 ? 'item' : 'itens'}
                  </p>
                )}

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3.5 text-sm text-muted">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" aria-hidden />
                    <span className="tabular-nums">{p.uses}</span> usos
                  </span>

                  {/* Ícone + rótulo: o cadeado nunca carrega o sentido sozinho. */}
                  <button
                    onClick={() => run(() => toggleProtocolAi(p.id, !p.aiEnabled))}
                    disabled={pending}
                    aria-pressed={p.aiEnabled}
                    className={
                      'tap flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-semibold transition-colors disabled:opacity-50 ' +
                      (p.aiEnabled ? 'bg-brand-soft text-brand-text' : 'bg-surface-2 text-muted')
                    }
                  >
                    {p.aiEnabled ? (
                      <Unlock className="h-3 w-3" aria-hidden />
                    ) : (
                      <Lock className="h-3 w-3" aria-hidden />
                    )}
                    {p.aiEnabled ? 'IA pode ajustar' : 'Rígido'}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Button icon={Plus} block className="sm:hidden" onClick={() => setCreating(true)}>
        Novo protocolo
      </Button>

      <ProtocolForm
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={createProtocol}
        title="Novo protocolo"
      />

      {editing && (
        <ProtocolForm
          open
          onClose={() => setEditing(null)}
          initial={editing}
          onSubmit={(input) => updateProtocol(editing.id, input)}
          onDelete={() => deleteProtocol(editing.id)}
          title="Editar protocolo"
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- FORMULÁRIO */

function ProtocolForm({
  open,
  onClose,
  onSubmit,
  onDelete,
  initial,
  title,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: ProtocolInput) => Promise<{ ok: boolean; error?: string }>;
  onDelete?: () => Promise<{ ok: boolean; error?: string }>;
  initial?: ProtocolView;
  title: string;
}) {
  const [name, setName] = useState(initial?.title ?? '');
  const [kind, setKind] = useState<ProtocolKind>(initial?.kind ?? 'nutricao');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [itemsText, setItemsText] = useState(initial?.items.join('\n') ?? '');
  const [aiEnabled, setAiEnabled] = useState(initial?.aiEnabled ?? true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await onSubmit({
        title: name,
        kind,
        description,
        items: itemsText.split('\n'),
        aiEnabled,
      });

      if (!result.ok) {
        setError(result.error ?? 'Não foi possível salvar.');
        return;
      }

      // Formulário de criação volta ao zero para o próximo protocolo.
      if (!initial) {
        setName('');
        setDescription('');
        setItemsText('');
      }
      onClose();
    });
  };

  const remove = () => {
    if (!onDelete) return;
    startTransition(async () => {
      const result = await onDelete();
      if (!result.ok) {
        setError(result.error ?? 'Não foi possível apagar.');
        return;
      }
      onClose();
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description="Este molde é o ponto de partida das propostas da IA."
      footer={
        <Button block onClick={save} disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Salvando…
            </>
          ) : (
            'Salvar protocolo'
          )}
        </Button>
      }
    >
      <div className="space-y-4 pb-4">
        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger-soft p-3 text-sm font-medium text-danger"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <Field label="Título">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Hipertrofia limpa (masculino)"
          />
        </Field>

        <Field label="Tipo">
          <Select value={kind} onChange={(e) => setKind(e.target.value as ProtocolKind)}>
            <option value="nutricao">Nutricional</option>
            <option value="treino">Ficha de treino</option>
            <option value="exames">Bateria de exames</option>
          </Select>
        </Field>

        <Field
          label="Descrição"
          hint="Para quem serve e em que situação aplicar. É o contexto que a IA lê."
        >
          <Textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Homens adultos em superávit calórico leve, sem restrição alimentar."
          />
        </Field>

        <Field label="Itens" hint="Um por linha.">
          <Textarea
            rows={7}
            value={itemsText}
            onChange={(e) => setItemsText(e.target.value)}
            placeholder={ITEM_PLACEHOLDER[kind]}
            className="font-mono text-sm"
          />
        </Field>

        <div className="flex items-start gap-4 rounded-xl border border-line bg-surface-2 p-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">A IA pode propor ajustes</p>
            <p className="mt-0.5 text-sm text-muted">
              Com isto desligado, o molde vira rígido: a IA o aplica como está e não
              sugere alterações sobre ele.
            </p>
          </div>
          <Switch
            checked={aiEnabled}
            onChange={setAiEnabled}
            label="Permitir que a IA proponha ajustes"
          />
        </div>

        {onDelete && (
          <button
            onClick={remove}
            disabled={pending}
            className="tap flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-danger disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Apagar este protocolo
          </button>
        )}
      </div>
    </Sheet>
  );
}

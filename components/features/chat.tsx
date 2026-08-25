'use client';

import { useEffect, useRef, useState } from 'react';
import {
  BrainCircuit,
  ChevronLeft,
  FileText,
  Paperclip,
  Search,
  Send,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import { Avatar, Badge, Card, EmptyState } from '@/components/ui';
import { Input } from '@/components/ui/interactive';
import { conversations, me, pro, thread, type ChatMessage } from '@/lib/data';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------- MENSAGENS */

function Bubble({ msg, peerName }: { msg: ChatMessage; peerName: string }) {
  if (msg.from === 'ai') {
    return (
      <div className="my-2 flex justify-center">
        <div className="flex max-w-md items-start gap-2.5 rounded-2xl border border-brand-line bg-brand-soft px-3.5 py-3">
          <BrainCircuit className="mt-0.5 h-4 w-4 shrink-0 text-brand-text" aria-hidden />
          <p className="text-sm leading-relaxed text-muted">{msg.text}</p>
        </div>
      </div>
    );
  }

  const mine = msg.from === 'me';
  return (
    <div className={cn('flex gap-2.5', mine ? 'justify-end' : 'justify-start')}>
      {!mine && <Avatar name={peerName} size="xs" className="mt-auto" />}
      <div className={cn('max-w-[78%] sm:max-w-[70%]', mine && 'items-end')}>
        <div
          className={cn(
            'px-3.5 py-2.5 text-sm leading-relaxed',
            mine
              ? 'rounded-2xl rounded-br-md bg-brand text-brand-on'
              : 'rounded-2xl rounded-bl-md border border-line bg-surface',
          )}
        >
          {msg.text}
        </div>
        <span
          className={cn(
            'mt-1 block text-2xs font-medium text-subtle',
            mine ? 'text-right' : 'text-left',
          )}
        >
          {msg.time}
        </span>
      </div>
    </div>
  );
}

function Composer({
  peerName,
  onSend,
  showAiHint,
}: {
  peerName: string;
  onSend: (text: string) => void;
  showAiHint?: boolean;
}) {
  const [text, setText] = useState('');

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  };

  return (
    <div className="shrink-0 border-t border-line bg-surface p-3">
      <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface-2 p-1.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/25">
        <button
          aria-label="Anexar arquivo"
          className="tap flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-subtle hover:text-fg"
        >
          <Paperclip className="h-5 w-5" aria-hidden />
        </button>

        <textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter envia; Shift+Enter quebra linha (só faz sentido no desktop).
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={`Mensagem para ${peerName.split(' ')[0]}`}
          aria-label="Escrever mensagem"
          className="max-h-28 min-h-[40px] flex-1 resize-none bg-transparent py-2.5 text-sm outline-none placeholder:text-subtle"
        />

        <button
          onClick={submit}
          disabled={!text.trim()}
          aria-label="Enviar mensagem"
          className="tap flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-on disabled:opacity-40"
        >
          <Send className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {showAiHint && (
        <button className="mt-2 flex items-center gap-1.5 px-1 text-2xs font-semibold text-brand-text hover:underline">
          <Sparkles className="h-3 w-3" aria-hidden />
          Sugerir resposta com IA
        </button>
      )}
    </div>
  );
}

function Conversation({
  peerName,
  peerMeta,
  messages,
  onSend,
  onBack,
  showAiHint,
  header,
}: {
  peerName: string;
  peerMeta: string;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onBack?: () => void;
  showAiHint?: boolean;
  header?: React.ReactNode;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-line bg-surface px-3 py-3">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Voltar para a lista"
            className="tap -ml-1 flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg lg:hidden"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
        )}
        <Avatar name={peerName} size="sm" online />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold">{peerName}</h2>
          <p className="truncate text-2xs text-muted">{peerMeta}</p>
        </div>
        {header}
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto bg-canvas p-4">
        <div className="flex justify-center pb-1">
          <span className="rounded-full border border-line bg-surface px-3 py-1 text-2xs font-bold uppercase tracking-wider text-subtle">
            Hoje
          </span>
        </div>
        {messages.map((m) => (
          <Bubble key={m.id} msg={m} peerName={peerName} />
        ))}
        <div ref={endRef} />
      </div>

      <Composer peerName={peerName} onSend={onSend} showAiHint={showAiHint} />
    </div>
  );
}

/* ------------------------------------------ VISÃO DO PACIENTE (1 conversa) */

export function PatientChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', from: 'them', text: `Bom dia, ${me.firstName}! Como foi a semana?`, time: '09:12' },
    {
      id: '2',
      from: 'me',
      text: 'Bom dia, doutor! Treinos em dia, mas o sono continua curto.',
      time: '09:30',
    },
    {
      id: '3',
      from: 'ai',
      text: 'A IA correlacionou seu sono médio de 6h10 com a queda de 8% no volume de treino da última semana.',
      time: '09:30',
    },
    {
      id: '4',
      from: 'them',
      text: 'Perfeito. Vamos manter o protocolo e focar em higiene do sono. Ajustei a ceia para ajudar.',
      time: '09:41',
    },
  ]);

  const send = (text: string) =>
    setMessages((prev) => [
      ...prev,
      {
        id: String(prev.length + 1),
        from: 'me',
        text,
        time: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    ]);

  return (
    <Card inset className="h-pane overflow-hidden">
      <Conversation
        peerName={me.coach}
        peerMeta={pro.role}
        messages={messages}
        onSend={send}
        header={
          <Badge tone="brand" icon={Stethoscope} className="hidden sm:inline-flex">
            Seu médico
          </Badge>
        }
      />
    </Card>
  );
}

/* --------------------------------------- VISÃO DO PROFISSIONAL (inbox) */

export function ProInboxView() {
  const [selected, setSelected] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ChatMessage[]>>(thread);
  const [query, setQuery] = useState('');

  // No desktop sempre há uma conversa aberta; no mobile, só depois do toque.
  const activeId = selected ?? conversations[0].id;
  const active = conversations.find((c) => c.id === activeId)!;
  const messages = drafts[activeId] ?? [];

  const filtered = conversations.filter((c) =>
    c.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const send = (text: string) =>
    setDrafts((prev) => ({
      ...prev,
      [activeId]: [
        ...(prev[activeId] ?? []),
        {
          id: String((prev[activeId]?.length ?? 0) + 1),
          from: 'me',
          text,
          time: new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ],
    }));

  return (
    <Card inset className="h-pane overflow-hidden lg:grid lg:grid-cols-[20rem_1fr]">
      {/* Lista — some no mobile quando uma conversa está aberta */}
      <div
        className={cn(
          'flex h-full min-h-0 flex-col border-line lg:flex lg:border-r',
          selected !== null && 'hidden',
        )}
      >
        <div className="shrink-0 border-b border-line p-3">
          <Input
            icon={Search}
            type="search"
            placeholder="Buscar conversa"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nenhuma conversa"
              description={`Nada encontrado para "${query}".`}
            />
          ) : (
            filtered.map((c) => {
              const isActive = c.id === activeId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className={cn(
                    'relative flex w-full items-center gap-3 border-b border-line px-4 py-3.5 text-left transition-colors',
                    'hover:bg-surface-2',
                    // Só destaca a linha ativa no desktop (no mobile a lista some).
                    isActive && 'lg:bg-surface-2',
                  )}
                >
                  {isActive && (
                    <span className="absolute inset-y-0 left-0 hidden w-1 bg-brand lg:block" />
                  )}
                  <Avatar name={c.name} size="sm" online={c.online} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span
                        className={cn(
                          'truncate text-sm',
                          c.unread > 0 ? 'font-bold' : 'font-semibold',
                        )}
                      >
                        {c.name}
                      </span>
                      <span className="shrink-0 text-2xs font-medium text-subtle">
                        {c.time}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-sm',
                          c.unread > 0 ? 'font-medium text-fg' : 'text-muted',
                        )}
                      >
                        {c.last}
                      </span>
                      {c.unread > 0 && (
                        <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-2xs font-bold text-brand-on">
                          {c.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Conversa — some no mobile enquanto a lista está aberta */}
      <div className={cn('h-full min-h-0', selected === null && 'hidden lg:block')}>
        <Conversation
          peerName={active.name}
          peerMeta={active.plan}
          messages={messages}
          onSend={send}
          onBack={() => setSelected(null)}
          showAiHint
          header={
            <button
              className="tap hidden h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold text-muted hover:text-fg sm:inline-flex"
              type="button"
            >
              <FileText className="h-4 w-4" aria-hidden />
              Prontuário
            </button>
          }
        />
      </div>
    </Card>
  );
}

'use client';

import { useEffect, useOptimistic, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  BrainCircuit,
  ChevronLeft,
  FileText,
  Loader2,
  Paperclip,
  Search,
  Send,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import { Avatar, Badge, Card, EmptyState } from '@/components/ui';
import { Input } from '@/components/ui/interactive';
import { markConversationRead, sendMessage } from '@/lib/actions/chat';
import type { ConversationView, MessageView } from '@/lib/queries/chat';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------- MENSAGENS */

function Bubble({ msg, peerName }: { msg: MessageView; peerName: string }) {
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
      <div className="max-w-[78%] sm:max-w-[70%]">
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
  pending,
  showAiHint,
}: {
  peerName: string;
  onSend: (text: string) => void;
  pending: boolean;
  showAiHint?: boolean;
}) {
  const [text, setText] = useState('');

  const submit = () => {
    const t = text.trim();
    if (!t || pending) return;
    onSend(t);
    setText('');
  };

  return (
    <div className="shrink-0 border-t border-line bg-surface p-3">
      <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface-2 p-1.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/25">
        <button
          type="button"
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
            // Enter envia; Shift+Enter quebra linha.
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
          disabled={!text.trim() || pending}
          aria-label="Enviar mensagem"
          className="tap flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-on disabled:opacity-40"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
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
  conversationId,
  peerName,
  peerMeta,
  messages,
  onBack,
  showAiHint,
  header,
}: {
  conversationId: string;
  peerName: string;
  peerMeta: string;
  messages: MessageView[];
  onBack?: () => void;
  showAiHint?: boolean;
  header?: React.ReactNode;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // A bolha aparece antes de o servidor responder.
  const [optimistic, addOptimistic] = useOptimistic(
    messages,
    (current: MessageView[], text: string) => [
      ...current,
      {
        id: `pending-${current.length}`,
        from: 'me' as const,
        text,
        time: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    ],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [optimistic.length]);

  // Ao abrir, zera o contador de não lidas.
  useEffect(() => {
    void markConversationRead(conversationId);
  }, [conversationId]);

  const send = (text: string) => {
    startTransition(async () => {
      addOptimistic(text);
      await sendMessage(conversationId, text);
      router.refresh();
    });
  };

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
        <Avatar name={peerName} size="sm" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold">{peerName}</h2>
          <p className="truncate text-2xs text-muted">{peerMeta}</p>
        </div>
        {header}
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto bg-canvas p-4">
        {optimistic.length === 0 ? (
          <EmptyState
            icon={Send}
            title="Nenhuma mensagem ainda"
            description="Escreva a primeira mensagem abaixo."
          />
        ) : (
          optimistic.map((m) => <Bubble key={m.id} msg={m} peerName={peerName} />)
        )}
        <div ref={endRef} />
      </div>

      <Composer peerName={peerName} onSend={send} pending={pending} showAiHint={showAiHint} />
    </div>
  );
}

/* ------------------------------------------ VISÃO DO PACIENTE (1 conversa) */

export function PatientChatView({
  conversation,
}: {
  conversation: { id: string; peerName: string; peerMeta: string; messages: MessageView[] };
}) {
  return (
    <Card inset className="h-pane overflow-hidden">
      <Conversation
        conversationId={conversation.id}
        peerName={conversation.peerName}
        peerMeta={conversation.peerMeta}
        messages={conversation.messages}
        header={
          <Badge tone="brand" icon={Stethoscope} className="hidden sm:inline-flex">
            Seu profissional
          </Badge>
        }
      />
    </Card>
  );
}

/* --------------------------------------- VISÃO DO PROFISSIONAL (inbox) */

export function ProInboxView({
  conversations,
  activeId,
  messages,
}: {
  conversations: ConversationView[];
  activeId: string | null;
  messages: MessageView[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  if (conversations.length === 0) {
    return (
      <Card className="h-pane">
        <EmptyState
          icon={Search}
          title="Nenhuma conversa"
          description="As conversas aparecem quando você tem pacientes vinculados."
        />
      </Card>
    );
  }

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];

  const filtered = conversations.filter((c) =>
    c.peerName.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const open = (id: string) => {
    setSelected(id);
    // A conversa é estado de URL: permite recarregar e compartilhar o link.
    router.push(`/pro/mensagens?conversa=${id}`);
  };

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
              const isActive = c.id === active.id;
              return (
                <button
                  key={c.id}
                  onClick={() => open(c.id)}
                  className={cn(
                    'relative flex w-full items-center gap-3 border-b border-line px-4 py-3.5 text-left transition-colors hover:bg-surface-2',
                    isActive && 'lg:bg-surface-2',
                  )}
                >
                  {isActive && (
                    <span className="absolute inset-y-0 left-0 hidden w-1 bg-brand lg:block" />
                  )}
                  <Avatar name={c.peerName} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span
                        className={cn(
                          'truncate text-sm',
                          c.unread > 0 ? 'font-bold' : 'font-semibold',
                        )}
                      >
                        {c.peerName}
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
          conversationId={active.id}
          peerName={active.peerName}
          peerMeta={active.peerMeta}
          messages={messages}
          onBack={() => setSelected(null)}
          showAiHint
          header={
            <button
              type="button"
              className="tap hidden h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold text-muted hover:text-fg sm:inline-flex"
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

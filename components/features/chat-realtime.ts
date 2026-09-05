'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { MessageView } from '@/lib/queries/chat';
import type { SenderKind } from '@/lib/supabase/types';

/**
 * Mensagens em tempo real.
 *
 * O chat era a única tela do app que ainda exigia recarregar para ver o que o
 * outro lado escreveu — o `router.refresh()` depois do envio só atualizava
 * quem enviou.
 *
 * A escuta é o Realtime do Postgres, filtrado por `conversation_id`. A RLS
 * vale dentro do canal: a política "participantes leem as mensagens" já
 * restringe cada assinante à própria conversa, então ninguém recebe evento de
 * uma conversa alheia mesmo forjando o filtro.
 */

type MessageRow = {
  id: string;
  sender_id: string | null;
  sender_kind: SenderKind;
  body: string;
  created_at: string;
};

const paraView = (row: MessageRow, viewerId: string): MessageView => ({
  id: row.id,
  from: row.sender_kind === 'ia' ? 'ai' : row.sender_id === viewerId ? 'me' : 'them',
  text: row.body,
  at: row.created_at,
});

export type RealtimeChat = {
  /** Mensagens que chegaram pelo canal e ainda não vieram do servidor. */
  extras: MessageView[];
  /** Marca um envio em andamento — ver o comentário sobre eco abaixo. */
  registrarEnvio: () => () => void;
  /** `true` enquanto o canal está conectado. */
  conectado: boolean;
};

export function useRealtimeMessages({
  conversationId,
  viewerId,
  onMensagemRecebida,
}: {
  conversationId: string;
  viewerId: string;
  /** Chamado quando chega mensagem do outro lado (para marcar como lida). */
  onMensagemRecebida?: () => void;
}): RealtimeChat {
  const [extras, setExtras] = useState<MessageView[]>([]);
  const [conectado, setConectado] = useState(false);

  /*
    Envios em andamento.

    Quando EU envio, a mensagem volta por dois caminhos quase ao mesmo tempo:
    o evento do Realtime e o `router.refresh()` que a Server Action dispara.
    Some-se a bolha otimista e o mesmo texto apareceria três vezes por alguns
    centésimos.

    Ignorar o eco do próprio envio resolve — mas só enquanto o envio está em
    curso. Fora dessa janela, uma mensagem com o meu id de remetente veio de
    outro aparelho meu, e essa precisa aparecer.
  */
  const enviando = useRef(0);
  const notificar = useRef(onMensagemRecebida);
  notificar.current = onMensagemRecebida;

  // Trocar de conversa zera o acumulado: o histórico da anterior não pertence
  // à nova.
  useEffect(() => setExtras([]), [conversationId]);

  useEffect(() => {
    if (!conversationId) return;

    const supabase = createClient();

    const canal = supabase
      .channel(`chat-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as MessageRow;
          const minha = row.sender_id === viewerId;

          if (minha && enviando.current > 0) return;

          setExtras((atuais) =>
            atuais.some((m) => m.id === row.id)
              ? atuais
              : [...atuais, paraView(row, viewerId)],
          );

          // Mensagem do outro lado com a conversa aberta já nasce lida.
          if (!minha) notificar.current?.();
        },
      )
      .subscribe((status) => setConectado(status === 'SUBSCRIBED'));

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [conversationId, viewerId]);

  const registrarEnvio = () => {
    enviando.current += 1;
    return () => {
      enviando.current = Math.max(0, enviando.current - 1);
    };
  };

  return { extras, registrarEnvio, conectado };
}

/**
 * Atualiza a lista da caixa de entrada quando chega mensagem.
 *
 * Sem filtro de conversa de propósito: a RLS já restringe os eventos às
 * conversas de quem está lendo, então um único canal cobre a caixa inteira —
 * inclusive as conversas que não estão abertas, que são justamente as que
 * precisam atualizar a prévia e o contador de não lidas.
 *
 * Aqui a resposta é `router.refresh()`, e não estado local: prévia, horário e
 * contagem são derivados no servidor, e recalculá-los no cliente criaria uma
 * segunda implementação para divergir da primeira.
 */
export function useRealtimeInbox(ativo: boolean) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!ativo) return;

    const supabase = createClient();

    const canal = supabase
      .channel('inbox-mensagens')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => {
          // Agrupa rajadas: várias mensagens seguidas viram um refresh só.
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => router.refresh(), 500);
        },
      )
      .subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(canal);
    };
  }, [ativo, router]);
}

/**
 * Junta o histórico do servidor com o que chegou pelo canal.
 *
 * A deduplicação é por id, e a ordenação usa o `created_at` do banco — que é
 * o mesmo instante exibido na bolha. Ordenar pelo momento de chegada faria a
 * lista discordar do relógio quando um evento atrasasse.
 *
 * ISO 8601 em UTC ordena corretamente por comparação de texto: os campos vêm
 * do mesmo formato, com largura fixa.
 */
export function mesclarMensagens(
  doServidor: MessageView[],
  extras: MessageView[],
): MessageView[] {
  if (extras.length === 0) return doServidor;

  const conhecidas = new Set(doServidor.map((m) => m.id));
  const pendentes = extras.filter((m) => !conhecidas.has(m.id));

  if (pendentes.length === 0) return doServidor;

  return [...doServidor, ...pendentes].sort((a, b) => (a.at < b.at ? -1 : 1));
}

/** Versão memoizada, para não reordenar a cada render. */
export function useMensagens(
  doServidor: MessageView[],
  extras: MessageView[],
): MessageView[] {
  return useMemo(() => mesclarMensagens(doServidor, extras), [doServidor, extras]);
}

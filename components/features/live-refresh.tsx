'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Atualização automática das telas de acompanhamento.
 *
 * Progresso, hidratação, treino e check-in mudam por caminhos que a aba atual
 * não conhece: o profissional lança uma medida, o celular registra um copo
 * d'água, a IA grava um relatório. Sem isto, o usuário veria número velho até
 * recarregar a página na mão.
 *
 * A escuta é o Realtime do Postgres, filtrado por `patient_id` — o cliente só
 * recebe eventos das próprias linhas, e a RLS continua valendo no canal.
 * Quando algo muda, `router.refresh()` refaz o render no servidor: os dados
 * continuam vindo do banco, e nenhum estado do cliente é inventado.
 *
 * Os eventos são agrupados em uma janela curta porque um lote de escritas
 * (um check-in grava em duas tabelas) dispararia vários refreshes seguidos.
 */
export function LiveRefresh({
  patientId,
  tables,
  channel,
}: {
  patientId: string;
  /** Tabelas a observar. Todas precisam ter a coluna `patient_id`. */
  tables: string[];
  /** Nome único do canal — evita colisão entre telas abertas ao mesmo tempo. */
  channel: string;
}) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const agendarRefresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 400);
    };

    const sub = supabase.channel(`${channel}-${patientId}`);

    for (const table of tables) {
      sub.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `patient_id=eq.${patientId}`,
        },
        agendarRefresh,
      );
    }

    sub.subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(sub);
    };
    // `tables` é literal em cada uso; serializar evita reinscrever a cada render.
  }, [patientId, channel, tables.join(','), router]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

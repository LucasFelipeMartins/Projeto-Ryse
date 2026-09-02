'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import {
  BellOff,
  BellRing,
  Check,
  Loader2,
  Send,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';
import { Button, Card } from '@/components/ui';
import {
  enviarNotificacaoDeTeste,
  registrarDispositivo,
  removerDispositivo,
  salvarFusoHorario,
} from '@/lib/actions/notifications';
import { cn } from '@/lib/utils';

/**
 * Ativação das notificações no aparelho.
 *
 * Três estados precisam ficar visíveis, porque cada um tem uma saída
 * diferente e confundi-los gera o clássico "liguei e não chega nada":
 *
 *   - o navegador não suporta push (iOS fora da tela de início, por exemplo);
 *   - a permissão foi negada — e aí só as configurações do navegador
 *     resolvem, nenhum botão nosso adianta;
 *   - a permissão existe, mas este aparelho ainda não está inscrito.
 *
 * O fuso do usuário é capturado junto: é ele que define a janela de silêncio
 * e o horário dos lembretes.
 */

type Estado =
  | 'carregando'
  | 'indisponivel'
  | 'bloqueado'
  | 'desativado'
  | 'ativado';

/**
 * A chave pública VAPID viaja em base64url e precisa virar bytes.
 *
 * O buffer é alocado explicitamente porque `Uint8Array.from` produz um
 * `Uint8Array<ArrayBufferLike>`, e `applicationServerKey` exige um
 * `BufferSource` respaldado por um ArrayBuffer de verdade.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normal = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normal);

  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function PushManager({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [estado, setEstado] = useState<Estado>('carregando');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const suportado =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  /** Descobre em que estado este aparelho está. */
  const sincronizar = useCallback(async () => {
    if (!suportado || !vapidPublicKey) {
      setEstado('indisponivel');
      return;
    }

    if (Notification.permission === 'denied') {
      setEstado('bloqueado');
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const existente = await registration.pushManager.getSubscription();

    setEstado(existente ? 'ativado' : 'desativado');
  }, [suportado, vapidPublicKey]);

  useEffect(() => {
    void sincronizar();

    // O fuso é do navegador, não do servidor: é ele que decide a que horas o
    // lembrete sai e quando começa o silêncio.
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) void salvarFusoHorario(tz);
  }, [sincronizar]);

  const ativar = () => {
    setError(null);
    setNotice(null);

    startTransition(async () => {
      try {
        const permissao = await Notification.requestPermission();

        if (permissao === 'denied') {
          setEstado('bloqueado');
          return;
        }
        if (permissao !== 'granted') {
          setError('Permissão não concedida.');
          return;
        }

        const registration = await navigator.serviceWorker.ready;

        // Reaproveita a inscrição existente quando houver: pedir de novo com
        // outra chave devolveria erro em vez de uma inscrição nova.
        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          }));

        const json = subscription.toJSON();

        if (!json.keys?.p256dh || !json.keys?.auth) {
          setError('Este navegador não devolveu as chaves da inscrição.');
          return;
        }

        const result = await registrarDispositivo({
          endpoint: subscription.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          userAgent: navigator.userAgent,
        });

        if (!result.ok) {
          setError(result.error ?? 'Não foi possível registrar o aparelho.');
          return;
        }

        setEstado('ativado');
        setNotice('Notificações ativadas neste aparelho.');
      } catch {
        setError('Não foi possível ativar as notificações neste aparelho.');
      }
    });
  };

  const desativar = () => {
    setError(null);
    setNotice(null);

    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          await removerDispositivo(subscription.endpoint);
          await subscription.unsubscribe();
        }

        setEstado('desativado');
        setNotice('Este aparelho não vai mais receber notificações.');
      } catch {
        setError('Não foi possível desativar agora.');
      }
    });
  };

  const testar = () => {
    setError(null);
    setNotice(null);

    startTransition(async () => {
      const result = await enviarNotificacaoDeTeste();
      if (!result.ok) {
        setError(result.error ?? 'Não foi possível enviar o teste.');
        return;
      }
      setNotice('Enviamos uma notificação de teste. Deve chegar em instantes.');
    });
  };

  /* ------------------------------------------------------------ render */

  const ICONE: Record<Estado, typeof BellRing> = {
    carregando: Smartphone,
    indisponivel: Smartphone,
    bloqueado: ShieldAlert,
    desativado: BellOff,
    ativado: BellRing,
  };

  const Icone = ICONE[estado];

  const TITULO: Record<Estado, string> = {
    carregando: 'Verificando este aparelho…',
    indisponivel: 'Push indisponível neste navegador',
    bloqueado: 'Notificações bloqueadas',
    desativado: 'Receber notificações neste aparelho',
    ativado: 'Notificações ativas neste aparelho',
  };

  const DESCRICAO: Record<Estado, string> = {
    carregando: 'Só um instante.',
    indisponivel:
      'No iPhone, adicione o Ryse à tela de início pelo Safari — o push só funciona a partir daí.',
    bloqueado:
      'Você bloqueou as notificações para este site. Reative nas configurações do navegador e volte aqui.',
    desativado:
      'Lembretes de treino, hidratação, check-in e mensagens chegam direto no seu celular.',
    ativado: 'Você recebe aqui os avisos das categorias ligadas abaixo.',
  };

  return (
    <Card
      className={cn(
        'transition-colors',
        estado === 'ativado' && 'border-brand-line bg-brand-soft',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            estado === 'ativado'
              ? 'bg-brand text-brand-on'
              : estado === 'bloqueado'
                ? 'bg-danger-soft text-danger'
                : 'bg-surface-2 text-muted',
          )}
        >
          {pending || estado === 'carregando' ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : (
            <Icone className="h-5 w-5" aria-hidden />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{TITULO[estado]}</h3>
          <p className="mt-1 text-sm text-muted">{DESCRICAO[estado]}</p>

          {(estado === 'desativado' || estado === 'ativado') && (
            <div className="mt-4 flex flex-wrap gap-2">
              {estado === 'desativado' ? (
                <Button size="sm" icon={BellRing} disabled={pending} onClick={ativar}>
                  Ativar notificações
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={Send}
                    disabled={pending}
                    onClick={testar}
                  >
                    Enviar teste
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={BellOff}
                    disabled={pending}
                    onClick={desativar}
                  >
                    Desativar aqui
                  </Button>
                </>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="mt-3 text-sm font-medium text-danger">
              {error}
            </p>
          )}
          {notice && (
            <p
              role="status"
              className="mt-3 flex items-center gap-1.5 text-sm font-medium text-success"
            >
              <Check className="h-4 w-4 shrink-0" aria-hidden />
              {notice}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

'use client';

import { useState, useTransition } from 'react';
import {
  Bell,
  Check,
  ClipboardCheck,
  Droplet,
  Dumbbell,
  FileBarChart,
  Loader2,
  MessageSquare,
  Moon,
  Stethoscope,
  TestTube,
  type LucideIcon,
} from 'lucide-react';
import { Card, SectionTitle } from '@/components/ui';
import { Select, Switch } from '@/components/ui/interactive';
import {
  salvarPreferenciasDeNotificacao,
  type NotificationPrefsInput,
} from '@/lib/actions/notifications';
import { cn } from '@/lib/utils';

/**
 * Preferências de notificação, por categoria.
 *
 * Salva sozinho a cada mudança, sem botão "Salvar": um interruptor que exige
 * confirmação depois é o tipo de coisa que o usuário esquece de fazer, e aí a
 * preferência que ele achou ter mudado nunca valeu.
 *
 * "Notificações gerais" governa as demais. Quando está desligada, as outras
 * aparecem esmaecidas — sem sumir, para que continue claro o que voltaria a
 * funcionar ao religá-la.
 */

type Categoria = {
  key: keyof NotificationPrefsInput;
  label: string;
  hint: string;
  icon: LucideIcon;
  /** Só faz sentido para quem é acompanhado por um profissional. */
  clinical?: boolean;
};

const CATEGORIAS: Categoria[] = [
  {
    key: 'workoutReminder',
    label: 'Lembretes de treino',
    hint: 'Um aviso no fim da tarde nos dias em que você treina.',
    icon: Dumbbell,
  },
  {
    key: 'hydrationReminder',
    label: 'Lembretes de hidratação',
    hint: 'Um empurrão à tarde, quando ainda dá para bater a meta.',
    icon: Droplet,
  },
  {
    key: 'checkinReminder',
    label: 'Check-in semanal',
    hint: 'Aviso na segunda e cobrança no domingo, se ainda estiver pendente.',
    icon: ClipboardCheck,
  },
  {
    key: 'reports',
    label: 'Relatórios',
    hint: 'Quando uma análise da IA ou do seu profissional ficar pronta.',
    icon: FileBarChart,
  },
  {
    key: 'messages',
    label: 'Mensagens',
    hint: 'Resposta do seu profissional. Chega mesmo no modo silencioso.',
    icon: MessageSquare,
  },
  {
    key: 'protocolChanges',
    label: 'Mudanças no protocolo',
    hint: 'Ajustes aprovados na sua dieta ou no seu treino.',
    icon: Stethoscope,
    clinical: true,
  },
  {
    key: 'examResults',
    label: 'Resultado de exames',
    hint: 'Quando um documento enviado terminar de ser analisado.',
    icon: TestTube,
    clinical: true,
  },
];

const HORAS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

export function NotificationPrefsCard({
  initial,
  showClinical = true,
}: {
  initial: NotificationPrefsInput;
  showClinical?: boolean;
}) {
  const [prefs, setPrefs] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pending, startTransition] = useTransition();

  const aplicar = (patch: Partial<NotificationPrefsInput>) => {
    const proximo = { ...prefs, ...patch };
    const anterior = prefs;

    setPrefs(proximo);
    setError(null);
    setSalvo(false);

    startTransition(async () => {
      const result = await salvarPreferenciasDeNotificacao(proximo);

      if (!result.ok) {
        // Reverte para o que estava: deixar o interruptor na posição nova
        // depois de uma falha mentiria sobre o estado salvo.
        setPrefs(anterior);
        setError(result.error ?? 'Não foi possível salvar.');
        return;
      }

      setSalvo(true);
    });
  };

  const visiveis = CATEGORIAS.filter((c) => showClinical || !c.clinical);
  const desligado = !prefs.generalEnabled;

  return (
    <section>
      <SectionTitle
        title="Notificações"
        hint="Escolha o que chega no seu celular."
        action={
          pending ? (
            <span className="flex items-center gap-1.5 text-sm text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Salvando
            </span>
          ) : salvo ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-success">
              <Check className="h-3.5 w-3.5" aria-hidden />
              Salvo
            </span>
          ) : undefined
        }
      />

      <Card inset className="overflow-hidden">
        {/* -------------------------------------------- chave mestra */}
        <div className="flex items-center gap-3 border-b border-line bg-surface-2 px-4 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
            <Bell className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Notificações gerais</p>
            <p className="mt-0.5 text-sm text-muted">
              Desligar aqui silencia todas as categorias de uma vez.
            </p>
          </div>
          <Switch
            checked={prefs.generalEnabled}
            onChange={(v) => aplicar({ generalEnabled: v })}
            label="Notificações gerais"
          />
        </div>

        {/* -------------------------------------------- por categoria */}
        <ul className={cn('divide-y divide-line transition-opacity', desligado && 'opacity-50')}>
          {visiveis.map((categoria) => (
            <li key={categoria.key} className="flex items-center gap-3 px-4 py-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
                <categoria.icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{categoria.label}</p>
                <p className="mt-0.5 text-sm text-muted">{categoria.hint}</p>
              </div>
              <Switch
                checked={Boolean(prefs[categoria.key])}
                onChange={(v) => aplicar({ [categoria.key]: v })}
                label={categoria.label}
              />
            </li>
          ))}
        </ul>

        {/* -------------------------------------------- silêncio */}
        <div
          className={cn(
            'border-t border-line px-4 py-4 transition-opacity',
            desligado && 'opacity-50',
          )}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
              <Moon className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Não perturbe</p>
              <p className="mt-0.5 text-sm text-muted">
                Lembretes nesse intervalo são adiados, não descartados. Mensagens
                de pessoas continuam chegando.
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-xs">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-muted">Das</span>
              <Select
                value={prefs.quietFrom}
                onChange={(e) => aplicar({ quietFrom: e.target.value })}
              >
                {HORAS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-muted">Até</span>
              <Select
                value={prefs.quietTo}
                onChange={(e) => aplicar({ quietTo: e.target.value })}
              >
                {HORAS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </div>
      </Card>

      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

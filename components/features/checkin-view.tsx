'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, ChevronLeft, ChevronRight, Loader2, Send, Sparkles } from 'lucide-react';
import { Badge, Button, Card, PageIntro, Progress } from '@/components/ui';
import { Field, Input, Sheet, Textarea } from '@/components/ui/interactive';
import { submitCheckin } from '@/lib/actions/patient';
import type { CheckinRow } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';

type Answers = {
  peso: string;
  sono: string;
  energia: number;
  fome: number;
  dor: number;
  adesao: number;
  obs: string;
};

const STEPS = ['Medidas', 'Como você está', 'Observações'] as const;

/** Escala de 1 a 5 com alvos de toque grandes — evita slider fino no mobile. */
function Scale({
  label,
  hint,
  value,
  onChange,
  lowLabel,
  highLabel,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  lowLabel: string;
  highLabel: string;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold">{label}</legend>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}

      <div className="mt-3 flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-pressed={value === n}
            className={cn(
              'tap h-12 flex-1 rounded-xl border text-base font-bold tabular-nums transition-colors',
              value === n
                ? 'border-brand bg-brand text-brand-on shadow-brand'
                : 'border-line bg-surface text-muted hover:border-line-strong hover:text-fg',
            )}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="mt-2 flex justify-between text-2xs font-medium text-subtle">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </fieldset>
  );
}

export function CheckinView({
  last,
  alreadySent,
}: {
  last: CheckinRow | null;
  alreadySent: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  // Pré-preenche com o último check-in: mais rápido do que digitar do zero.
  const [a, setA] = useState<Answers>({
    peso: last?.weight_kg ? String(last.weight_kg).replace('.', ',') : '',
    sono: last?.sleep_hours ? String(last.sleep_hours).replace('.', ',') : '',
    energia: last?.energy ?? 3,
    fome: last?.hunger ?? 3,
    dor: last?.pain ?? 1,
    adesao: last?.adherence ?? 4,
    obs: '',
  });

  const decimal = (value: string) => {
    const n = Number(value.replace(',', '.'));
    return value.trim() && Number.isFinite(n) ? n : null;
  };

  const send = () => {
    setError(null);
    startSaving(async () => {
      const result = await submitCheckin({
        weightKg: decimal(a.peso),
        sleepHours: decimal(a.sono),
        energy: a.energia,
        hunger: a.fome,
        pain: a.dor,
        adherence: a.adesao,
        notes: a.obs,
      });

      if (!result.ok) {
        setError(result.error ?? 'Não foi possível enviar.');
        return;
      }
      setSent(true);
    });
  };

  const set = <K extends keyof Answers>(key: K, value: Answers[K]) =>
    setA((prev) => ({ ...prev, [key]: value }));

  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageIntro
        eyebrow={`Etapa ${step + 1} de ${STEPS.length}`}
        title="Check-in semanal"
        description="Leva menos de dois minutos e é o que alimenta os ajustes do seu protocolo."
        action={alreadySent ? <Badge tone="success">Enviado</Badge> : undefined}
      />

      {alreadySent && !sent && (
        <Card className="flex items-start gap-2.5 border-brand-line bg-brand-soft">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-text" aria-hidden />
          <p className="text-sm text-muted">
            Você já enviou o check-in desta semana. Enviar de novo substitui as
            respostas anteriores.
          </p>
        </Card>
      )}

      {error && (
        <Card className="flex items-start gap-2.5 border-danger/25 bg-danger-soft">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
          <p className="text-sm font-medium text-danger">{error}</p>
        </Card>
      )}

      <div>
        <Progress
          value={((step + 1) / STEPS.length) * 100}
          label={`Etapa ${step + 1} de ${STEPS.length}`}
        />
        <div className="mt-2 flex justify-between">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={cn(
                'text-2xs font-semibold',
                i <= step ? 'text-brand-text' : 'text-subtle',
              )}
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      <Card className="space-y-6">
        {step === 0 && (
          <div className="animate-fade-in space-y-5">
            <Field label="Peso de hoje (kg)" hint="Medido em jejum, logo ao acordar.">
              <Input
                inputMode="decimal"
                value={a.peso}
                onChange={(e) => set('peso', e.target.value)}
              />
            </Field>

            <Field label="Média de sono na semana (horas)">
              <Input
                inputMode="decimal"
                value={a.sono}
                onChange={(e) => set('sono', e.target.value)}
              />
            </Field>

            <Scale
              label="Adesão ao plano"
              hint="Quanto você conseguiu seguir dieta e treino nesta semana?"
              value={a.adesao}
              onChange={(v) => set('adesao', v)}
              lowLabel="Quase nada"
              highLabel="Integralmente"
            />
          </div>
        )}

        {step === 1 && (
          <div className="animate-fade-in space-y-6">
            <Scale
              label="Nível de energia"
              value={a.energia}
              onChange={(v) => set('energia', v)}
              lowLabel="Exausto"
              highLabel="Muita energia"
            />
            <Scale
              label="Fome ao longo do dia"
              value={a.fome}
              onChange={(v) => set('fome', v)}
              lowLabel="Sem fome"
              highLabel="Fome constante"
            />
            <Scale
              label="Dor ou desconforto"
              hint="Considere articulações e musculatura durante os treinos."
              value={a.dor}
              onChange={(v) => set('dor', v)}
              lowLabel="Nenhuma"
              highLabel="Muita dor"
            />
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in space-y-5">
            <Field
              label="Quer contar algo ao seu profissional?"
              hint="Viagens, eventos, mudanças de rotina, sintomas — tudo ajuda a IA a contextualizar."
            >
              <Textarea
                rows={5}
                value={a.obs}
                placeholder="Ex.: viajei na quarta e não consegui treinar."
                onChange={(e) => set('obs', e.target.value)}
              />
            </Field>

            <div className="rounded-xl border border-brand-line bg-brand-soft p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <Sparkles className="h-4 w-4 text-brand-text" aria-hidden />
                Resumo do envio
              </h3>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {[
                  ['Peso', `${a.peso} kg`],
                  ['Sono', `${a.sono} h`],
                  ['Energia', `${a.energia}/5`],
                  ['Adesão', `${a.adesao}/5`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="text-muted">{k}</dt>
                    <dd className="font-semibold tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}
      </Card>

      {/* Barra de ação fixa no rodapé — o padrão de formulário em app nativo. */}
      <div className="flex gap-3">
        {step > 0 && (
          <Button
            variant="secondary"
            icon={ChevronLeft}
            onClick={() => setStep((s) => s - 1)}
            className="flex-1"
          >
            Voltar
          </Button>
        )}
        {isLastStep ? (
          <Button
            icon={saving ? undefined : Send}
            onClick={send}
            disabled={saving}
            className="flex-1"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Enviando…
              </>
            ) : (
              'Enviar check-in'
            )}
          </Button>
        ) : (
          <Button
            iconRight={ChevronRight}
            onClick={() => setStep((s) => s + 1)}
            className="flex-1"
          >
            Continuar
          </Button>
        )}
      </div>

      <Sheet
        open={sent}
        onClose={() => setSent(false)}
        title="Check-in enviado"
        description="A IA já começou a cruzar suas respostas com os dados de treino e exames."
        footer={
          <Button block onClick={() => router.push('/inicio')}>
            Voltar para o início
          </Button>
        }
      >
        <div className="flex flex-col items-center py-6">
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-success text-white">
            <Check className="h-8 w-8" strokeWidth={3} aria-hidden />
          </span>
          <p className="max-w-xs text-center text-sm text-muted">
            Se algum ajuste for necessário, ele aparece no seu plano após a aprovação do
            seu profissional — normalmente em até 24 horas.
          </p>
        </div>
      </Sheet>
    </div>
  );
}

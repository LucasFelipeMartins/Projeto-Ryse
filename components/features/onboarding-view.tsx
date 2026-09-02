'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertCircle,
  Apple,
  ArrowLeft,
  ArrowRight,
  Check,
  Dumbbell,
  HeartPulse,
  Loader2,
  Ruler,
  Sparkles,
  Target,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { Badge, Button, Card } from '@/components/ui';
import { Field, Input, Select, Textarea } from '@/components/ui/interactive';
import { AvatarUploader } from '@/components/features/avatar-uploader';
import { concluirOnboarding } from '@/lib/actions/profile';
import { computeWaterGoal } from '@/lib/hydration';
import { cn } from '@/lib/utils';
import type { SessionUser } from '@/lib/supabase/server';
import type { ActivityLevel, Sex, TrainingLevel } from '@/lib/supabase/types';

/**
 * Formulário de primeiro acesso.
 *
 * Um passo por vez, e não um formulário de trinta campos: a taxa de abandono
 * de um formulário longo numa tela de celular é alta, e aqui abandonar
 * significa não entrar no app.
 *
 * A validação acontece por etapa — o botão "Continuar" só libera quando o
 * passo está completo —, então o erro aparece ao lado do campo, no momento
 * em que ele acontece, e não no fim depois de tudo preenchido.
 *
 * O servidor revalida tudo de novo em `concluirOnboarding`. O que se decide
 * aqui é ritmo, não segurança.
 */

type Step = {
  id: string;
  title: string;
  hint: string;
  icon: LucideIcon;
};

const STEPS: Step[] = [
  { id: 'voce', title: 'Sobre você', hint: 'Como devemos te chamar.', icon: UserRound },
  { id: 'corpo', title: 'Seu corpo', hint: 'A base de todos os cálculos.', icon: Ruler },
  { id: 'objetivo', title: 'Seu objetivo', hint: 'Para onde queremos ir.', icon: Target },
  { id: 'treino', title: 'Treino', hint: 'Sua rotina de exercício.', icon: Dumbbell },
  { id: 'nutricao', title: 'Alimentação', hint: 'O que entra no seu prato.', icon: Apple },
  { id: 'saude', title: 'Saúde', hint: 'O que precisamos considerar.', icon: HeartPulse },
];

type Form = {
  fullName: string;
  phone: string;
  birthDate: string;
  sex: string;
  heightCm: string;
  weightKg: string;
  goal: string;
  activityLevel: string;
  trainingLevel: string;
  trainingDays: string;
  routine: string;
  foodPreferences: string;
  foodRestrictions: string;
  healthNotes: string;
};

const OBJETIVOS = [
  'Emagrecimento',
  'Ganho de massa muscular',
  'Recomposição corporal',
  'Performance esportiva',
  'Saúde e longevidade',
  'Controle de exames alterados',
];

const num = (v: string): number | null => {
  const n = Number(v.replace(',', '.'));
  return v.trim() && Number.isFinite(n) ? n : null;
};

const lista = (v: string) =>
  v
    .split(/[,;\n]/)
    .map((i) => i.trim())
    .filter(Boolean);

export function OnboardingView({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [form, setForm] = useState<Form>({
    fullName: user.fullName,
    phone: user.phone ?? '',
    birthDate: user.birthDate ?? '',
    sex: user.sex ?? '',
    heightCm: user.heightCm ? String(user.heightCm) : '',
    weightKg: '',
    goal: user.goal ?? '',
    activityLevel: user.activityLevel ?? '',
    trainingLevel: user.trainingLevel ?? '',
    trainingDays: user.trainingDays !== null ? String(user.trainingDays) : '',
    routine: user.routine ?? '',
    foodPreferences: user.foodPreferences.join(', '),
    foodRestrictions: user.foodRestrictions.join(', '),
    healthNotes: user.healthNotes ?? '',
  });

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };

  /** O que falta no passo atual. `null` = pode seguir. */
  const problema = useMemo((): string | null => {
    switch (STEPS[step].id) {
      case 'voce':
        if (form.fullName.trim().length < 3) return 'Informe seu nome completo.';
        return null;

      case 'corpo': {
        const altura = num(form.heightCm);
        const peso = num(form.weightKg);
        if (altura === null) return 'Informe sua altura em centímetros.';
        if (altura < 100 || altura > 250) return 'A altura deve ficar entre 100 e 250 cm.';
        if (peso === null) return 'Informe seu peso atual em quilos.';
        if (peso < 20 || peso > 400) return 'O peso deve ficar entre 20 e 400 kg.';
        return null;
      }

      case 'objetivo':
        if (form.goal.trim().length < 3) return 'Escolha ou descreva seu objetivo.';
        return null;

      default:
        return null;
    }
  }, [step, form]);

  const ultimo = step === STEPS.length - 1;

  const avancar = () => {
    if (problema) {
      setError(problema);
      return;
    }
    if (!ultimo) {
      setStep((s) => s + 1);
      // Passo novo começa do topo — no celular, sem isso o usuário
      // continuaria no meio da tela.
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    finalizar();
  };

  const finalizar = () => {
    setError(null);

    startTransition(async () => {
      const result = await concluirOnboarding({
        fullName: form.fullName,
        phone: form.phone,
        birthDate: form.birthDate || null,
        sex: (form.sex || null) as Sex | null,
        heightCm: num(form.heightCm),
        weightKg: num(form.weightKg),
        goal: form.goal,
        activityLevel: (form.activityLevel || null) as ActivityLevel | null,
        trainingLevel: (form.trainingLevel || null) as TrainingLevel | null,
        trainingDays: num(form.trainingDays),
        routine: form.routine,
        foodPreferences: lista(form.foodPreferences),
        foodRestrictions: lista(form.foodRestrictions),
        healthNotes: form.healthNotes,
      });

      if (!result.ok) {
        setError(result.error ?? 'Não foi possível salvar.');
        return;
      }

      router.replace('/inicio');
      router.refresh();
    });
  };

  const atual = STEPS[step];
  const progresso = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6 sm:py-10">
      {/* ------------------------------------------------ progresso */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-brand-text">
            Passo {step + 1} de {STEPS.length}
          </span>
          <span className="text-muted">{Math.round(progresso)}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-label={`Passo ${step + 1} de ${STEPS.length}`}
          className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3"
        >
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-500 ease-spring"
            style={{ width: `${progresso}%` }}
          />
        </div>
      </div>

      <Card>
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
            <atual.icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight">{atual.title}</h1>
            <p className="mt-0.5 text-sm text-muted">{atual.hint}</p>
          </div>
        </div>

        <div className="space-y-4">
          {atual.id === 'voce' && (
            <>
              <div className="rounded-xl border border-line bg-surface-2 p-4">
                <AvatarUploader
                  userId={user.id}
                  name={form.fullName || user.fullName}
                  currentUrl={user.avatarUrl}
                  size="lg"
                />
              </div>

              <Field label="Nome completo">
                <Input
                  value={form.fullName}
                  onChange={(e) => set('fullName', e.target.value)}
                  autoComplete="name"
                  placeholder="Como você quer ser chamado"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Data de nascimento" hint="Ajusta suas metas por faixa etária.">
                  <Input
                    type="date"
                    value={form.birthDate}
                    onChange={(e) => set('birthDate', e.target.value)}
                    max={new Date().toISOString().slice(0, 10)}
                  />
                </Field>

                <Field label="Sexo">
                  <Select value={form.sex} onChange={(e) => set('sex', e.target.value)}>
                    <option value="">Prefiro não informar</option>
                    <option value="feminino">Feminino</option>
                    <option value="masculino">Masculino</option>
                    <option value="outro">Outro</option>
                  </Select>
                </Field>
              </div>

              <Field label="Telefone" hint="Opcional. Usado só para contato da clínica.">
                <Input
                  type="tel"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  autoComplete="tel"
                  placeholder="(11) 90000-0000"
                />
              </Field>
            </>
          )}

          {atual.id === 'corpo' && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Altura (cm)">
                  <Input
                    inputMode="numeric"
                    value={form.heightCm}
                    onChange={(e) => set('heightCm', e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="175"
                  />
                </Field>

                <Field label="Peso atual (kg)">
                  <Input
                    inputMode="decimal"
                    value={form.weightKg}
                    onChange={(e) =>
                      set('weightKg', e.target.value.replace(/[^\d.,]/g, ''))
                    }
                    placeholder="78,5"
                  />
                </Field>
              </div>

              <MetaDeAgua form={form} />
            </>
          )}

          {atual.id === 'objetivo' && (
            <>
              <div>
                <p className="mb-2 text-sm font-semibold">Objetivo principal</p>
                <div className="flex flex-wrap gap-2">
                  {OBJETIVOS.map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => set('goal', o)}
                      aria-pressed={form.goal === o}
                      className={cn(
                        'tap rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors',
                        form.goal === o
                          ? 'border-brand bg-brand text-brand-on'
                          : 'border-line bg-surface text-muted hover:border-line-strong hover:text-fg',
                      )}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>

              <Field label="Ou descreva com suas palavras">
                <Input
                  value={form.goal}
                  onChange={(e) => set('goal', e.target.value)}
                  placeholder="Ex.: perder 8 kg mantendo massa muscular"
                />
              </Field>

              <Field
                label="Nível de atividade no dia a dia"
                hint="Considere trabalho e deslocamento, não só o treino."
              >
                <Select
                  value={form.activityLevel}
                  onChange={(e) => set('activityLevel', e.target.value)}
                >
                  <option value="">Selecione</option>
                  <option value="sedentario">Sedentário — a maior parte do dia sentado</option>
                  <option value="leve">Leve — caminhadas ocasionais</option>
                  <option value="moderado">Moderado — em pé boa parte do dia</option>
                  <option value="intenso">Intenso — trabalho físico</option>
                  <option value="atleta">Atleta — treino em alto volume</option>
                </Select>
              </Field>
            </>
          )}

          {atual.id === 'treino' && (
            <>
              <Field label="Sua experiência com treino">
                <Select
                  value={form.trainingLevel}
                  onChange={(e) => set('trainingLevel', e.target.value)}
                >
                  <option value="">Selecione</option>
                  <option value="iniciante">Iniciante — menos de 6 meses</option>
                  <option value="intermediario">Intermediário — 6 meses a 2 anos</option>
                  <option value="avancado">Avançado — mais de 2 anos</option>
                </Select>
              </Field>

              <div>
                <p className="mb-2 text-sm font-semibold">
                  Dias de treino por semana
                </p>
                <div className="flex flex-wrap gap-2">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => set('trainingDays', String(d))}
                      aria-pressed={form.trainingDays === String(d)}
                      className={cn(
                        'tap h-11 w-11 rounded-xl border text-sm font-bold tabular-nums transition-colors',
                        form.trainingDays === String(d)
                          ? 'border-brand bg-brand text-brand-on'
                          : 'border-line bg-surface text-muted hover:border-line-strong hover:text-fg',
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-sm text-muted">
                  A ficha gerada pela IA respeita esse número.
                </p>
              </div>

              <Field
                label="Sua rotina"
                hint="Horários, turno de trabalho, quando consegue treinar."
              >
                <Textarea
                  rows={3}
                  value={form.routine}
                  onChange={(e) => set('routine', e.target.value)}
                  placeholder="Ex.: trabalho das 9h às 18h, treino de manhã cedo, almoço fora de casa"
                />
              </Field>
            </>
          )}

          {atual.id === 'nutricao' && (
            <>
              <Field
                label="Restrições alimentares"
                hint="Alergias, intolerâncias, o que você não come. Separe por vírgula."
              >
                <Textarea
                  rows={2}
                  value={form.foodRestrictions}
                  onChange={(e) => set('foodRestrictions', e.target.value)}
                  placeholder="lactose, frutos do mar, amendoim"
                />
              </Field>

              <Field
                label="Preferências"
                hint="O que você gosta e gostaria de manter no cardápio."
              >
                <Textarea
                  rows={2}
                  value={form.foodPreferences}
                  onChange={(e) => set('foodPreferences', e.target.value)}
                  placeholder="ovos no café, arroz e feijão no almoço, frutas à tarde"
                />
              </Field>

              <Card inset className="flex items-start gap-3 border-brand-line bg-brand-soft p-4">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-text" aria-hidden />
                <p className="text-sm text-muted">
                  Restrição alimentar é regra, não sugestão: a IA nunca monta uma refeição
                  com algo que você listou aqui.
                </p>
              </Card>
            </>
          )}

          {atual.id === 'saude' && (
            <>
              <Field
                label="Histórico de saúde"
                hint="Condições, cirurgias, medicamentos em uso, dores ou limitações."
              >
                <Textarea
                  rows={4}
                  value={form.healthNotes}
                  onChange={(e) => set('healthNotes', e.target.value)}
                  placeholder="Ex.: hipotireoidismo controlado, hérnia de disco L5, uso de levotiroxina"
                />
              </Field>

              <Card inset className="border-line bg-surface-2 p-4">
                <p className="text-sm font-semibold">Quase lá</p>
                <p className="mt-1 text-sm text-muted">
                  Ao concluir, liberamos seu painel com as metas já calculadas a partir do
                  que você informou. Tudo pode ser editado depois no seu perfil.
                </p>
              </Card>
            </>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl border border-danger/25 bg-danger-soft p-3 text-sm font-medium text-danger"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        {/* ------------------------------------------------ navegação */}
        <div className="mt-6 flex items-center gap-3 border-t border-line pt-5">
          {step > 0 && (
            <Button
              type="button"
              variant="secondary"
              icon={ArrowLeft}
              disabled={pending}
              onClick={() => {
                setError(null);
                setStep((s) => s - 1);
              }}
            >
              Voltar
            </Button>
          )}

          <Button
            type="button"
            block={step === 0}
            className={step > 0 ? 'flex-1' : undefined}
            disabled={pending}
            iconRight={ultimo ? undefined : ArrowRight}
            icon={ultimo && !pending ? Check : undefined}
            onClick={avancar}
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Salvando…
              </>
            ) : ultimo ? (
              'Concluir e entrar'
            ) : (
              'Continuar'
            )}
          </Button>
        </div>
      </Card>

      {/* Pular só existe onde nada essencial se perde. */}
      {['treino', 'nutricao', 'saude'].includes(atual.id) && !ultimo && (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setStep((s) => s + 1);
          }}
          className="tap mx-auto mt-4 block text-sm font-semibold text-muted hover:text-fg"
        >
          Preencher isso depois
        </button>
      )}
    </div>
  );
}

/**
 * Prévia da meta de hidratação.
 *
 * Mostrar o número surgindo enquanto a pessoa digita o peso explica, sem
 * texto, por que o app pediu esse dado — e usa exatamente a mesma função que
 * o restante do sistema, então o valor não muda depois.
 */
function MetaDeAgua({ form }: { form: Form }) {
  const peso = num(form.weightKg);
  const altura = num(form.heightCm);

  if (peso === null || peso < 20 || peso > 400) {
    return (
      <Card inset className="border-line bg-surface-2 p-4">
        <p className="text-sm text-muted">
          Com seu peso e sua altura calculamos automaticamente a meta diária de água,
          as faixas de IMC e a base para dieta e treino.
        </p>
      </Card>
    );
  }

  const meta = computeWaterGoal({
    weightKg: peso,
    heightCm: altura,
    birthDate: form.birthDate || null,
    activityLevel: form.activityLevel || null,
    trainingDays: num(form.trainingDays),
    overrideMl: null,
  });

  return (
    <Card inset className="border-brand-line bg-brand-soft p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Sua meta diária de água</p>
          <p className="mt-0.5 text-sm text-muted">
            Calculada a partir do que você informou.
          </p>
        </div>
        <Badge tone="brand" icon={Activity} className="px-2.5 py-1 text-sm">
          {(meta.goalMl / 1000).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{' '}
          L
        </Badge>
      </div>
    </Card>
  );
}

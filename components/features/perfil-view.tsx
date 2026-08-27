'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import {
  AlertCircle,
  Bell,
  Check,
  ChevronRight,
  Droplet,
  FileText,
  HelpCircle,
  Loader2,
  Palette,
  Ruler,
  Scale,
  Share2,
  Shield,
  Smartphone,
  Stethoscope,
  Target,
} from 'lucide-react';
import { Badge, Button, Card, PageIntro, SectionTitle } from '@/components/ui';
import { Field, Input, Sheet, Textarea, ThemePicker } from '@/components/ui/interactive';
import { AvatarUploader } from '@/components/features/avatar-uploader';
import { SignOutButton } from '@/components/layout/app-shell';
import { registrarPeso } from '@/lib/actions/patient';
import { atualizarPerfil } from '@/lib/actions/profile';
import { computeWaterGoal, explainWaterGoal } from '@/lib/hydration';
import type { SessionUser } from '@/lib/supabase/server';

/**
 * Perfil do paciente.
 *
 * Reorganizado em torno do que de fato existe e é editável. As linhas que
 * antes não levavam a lugar nenhum ("Assinatura e pagamento", "Exportar meus
 * dados") ou foram ligadas a uma tela real, ou saíram: um item de menu que
 * não faz nada ao ser tocado é pior do que não existir.
 *
 * O peso ganhou lugar de destaque porque é o dado que mais muda e do qual
 * mais coisa depende — meta de hidratação, gráfico de evolução e o contexto
 * que a IA lê.
 */

export function PerfilView({
  user,
  professionalName,
  latestWeightKg,
  notificationsEnabled,
}: {
  user: SessionUser;
  professionalName: string | null;
  latestWeightKg: number | null;
  /** Quantas categorias de notificação estão ativas — resumo para o atalho. */
  notificationsEnabled: number;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [pesoOpen, setPesoOpen] = useState(false);
  const [install, setInstall] = useState(false);

  const memberSince = new Date(user.createdAt).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  const meta = computeWaterGoal({
    weightKg: latestWeightKg,
    heightCm: user.heightCm,
    birthDate: user.birthDate,
    activityLevel: user.activityLevel,
    trainingDays: user.trainingDays,
    overrideMl: user.waterGoalOverrideMl,
  });

  const stats = [
    { icon: Target, label: 'Objetivo', value: user.goal ?? 'A definir' },
    {
      icon: Ruler,
      label: 'Altura',
      value: user.heightCm ? `${user.heightCm} cm` : '—',
    },
    {
      icon: Scale,
      label: 'Peso atual',
      value: latestWeightKg
        ? `${latestWeightKg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`
        : '—',
    },
    {
      icon: Stethoscope,
      label: 'Profissional',
      value: professionalName ?? 'A definir',
    },
  ];

  return (
    <div className="space-y-8">
      <PageIntro title="Perfil" description="Sua conta, seus dados e as preferências do app." />

      {/* ------------------------------------------------ identidade */}
      <Card>
        <AvatarUploader
          userId={user.id}
          name={user.fullName}
          currentUrl={user.avatarUrl}
          size="xl"
        />

        <div className="mt-5 border-t border-line pt-5">
          <h2 className="truncate text-lg font-bold tracking-tight">{user.fullName}</h2>
          <p className="truncate text-sm text-muted">{user.email}</p>

          <div className="mt-2 flex flex-wrap gap-2">
            {user.plan && <Badge tone="brand">Ryse {user.plan}</Badge>}
            <Badge tone="neutral">Desde {memberSince}</Badge>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-2 border-t border-line pt-5 sm:grid-cols-2">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-2.5 rounded-xl bg-surface-2 px-3 py-2.5"
            >
              <s.icon className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
              <div className="min-w-0">
                <dt className="text-2xs font-medium text-subtle">{s.label}</dt>
                <dd className="truncate text-sm font-semibold">{s.value}</dd>
              </div>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
            Editar dados
          </Button>
          <Button variant="secondary" size="sm" icon={Scale} onClick={() => setPesoOpen(true)}>
            Registrar peso
          </Button>
        </div>
      </Card>

      {/* ------------------------------------------------ hidratação */}
      <Card className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
          <Droplet className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">
            Meta de água:{' '}
            <span className="tabular-nums">
              {meta.goalMl.toLocaleString('pt-BR')} ml por dia
            </span>
          </h3>
          <p className="mt-1 text-sm text-muted">{explainWaterGoal(meta)}</p>
          {!meta.manual && latestWeightKg === null && (
            <p className="mt-2 text-sm text-warn">
              Registre seu peso para calcularmos a meta certa para você.
            </p>
          )}
        </div>
      </Card>

      {/* ------------------------------------------------ preferências */}
      <section>
        <SectionTitle title="Preferências" />
        <Card inset className="divide-y divide-line overflow-hidden">
          <Link
            href="/notificacoes"
            className="tap flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
              <Bell className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Notificações</span>
              <span className="mt-0.5 block truncate text-sm text-muted">
                {notificationsEnabled > 0
                  ? `${notificationsEnabled} ${
                      notificationsEnabled === 1 ? 'categoria ativa' : 'categorias ativas'
                    }`
                  : 'Todas desligadas'}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
          </Link>

          <Link
            href="/documentos"
            className="tap flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
              <FileText className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Meus documentos</span>
              <span className="mt-0.5 block truncate text-sm text-muted">
                Exames, laudos e receitas enviados
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
          </Link>

          <Link
            href="/profissionais"
            className="tap flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
              <Stethoscope className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Meu profissional</span>
              <span className="mt-0.5 block truncate text-sm text-muted">
                {professionalName ?? 'Escolher quem vai me acompanhar'}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
          </Link>
        </Card>
      </section>

      {/* ------------------------------------------------ aparência */}
      <section>
        <SectionTitle title="Aparência" hint="O tema acompanha o sistema por padrão." />
        <Card>
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
              <Palette className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <p className="text-sm font-semibold">Tema do aplicativo</p>
          </div>
          <ThemePicker />
        </Card>
      </section>

      {/* ------------------------------------------------ instalar */}
      <Card className="flex flex-col gap-4 border-brand-line bg-brand-soft sm:flex-row sm:items-center">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-on">
          <Smartphone className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold">Instale o Ryse no seu celular</h3>
          <p className="mt-0.5 text-sm text-muted">
            Funciona como app nativo no Android e no iPhone, direto da tela de início.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setInstall(true)}>
          Como instalar
        </Button>
      </Card>

      {/* ------------------------------------------------ conta */}
      <section>
        <SectionTitle title="Conta" />
        <Card inset className="divide-y divide-line overflow-hidden">
          <div className="flex items-start gap-3 px-4 py-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
              <Shield className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <p className="min-w-0 flex-1 text-sm text-muted">
              Seus dados de saúde são protegidos pela LGPD. Só você e o profissional
              vinculado a você conseguem lê-los — a regra é aplicada no banco.
            </p>
          </div>

          <Link
            href="/mensagens"
            className="tap flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
              <HelpCircle className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Ajuda e suporte</span>
              <span className="mt-0.5 block truncate text-sm text-muted">
                Fale com a clínica pelo chat
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
          </Link>
        </Card>

        <Card inset className="mt-3 p-4">
          <SignOutButton />
        </Card>
      </section>

      <p className="pb-2 text-center text-2xs text-subtle">
        Ryse · versão 1.0.0 · feito para Android e iOS
      </p>

      <EditSheet open={editOpen} onClose={() => setEditOpen(false)} user={user} />
      <PesoSheet
        open={pesoOpen}
        onClose={() => setPesoOpen(false)}
        atual={latestWeightKg}
      />

      <Sheet
        open={install}
        onClose={() => setInstall(false)}
        title="Instalar o Ryse"
        description="O app é instalado direto pelo navegador, sem passar por loja."
      >
        <div className="space-y-5 pb-4">
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
              <Smartphone className="h-4 w-4 text-brand-text" aria-hidden />
              Android (Chrome)
            </h3>
            <ol className="space-y-2 text-sm text-muted">
              <li>1. Toque no menu de três pontos do navegador.</li>
              <li>2. Escolha “Instalar app” ou “Adicionar à tela inicial”.</li>
              <li>3. Confirme. O ícone do Ryse aparece junto dos outros apps.</li>
            </ol>
          </div>

          <div className="border-t border-line pt-5">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
              <Share2 className="h-4 w-4 text-brand-text" aria-hidden />
              iPhone e iPad (Safari)
            </h3>
            <ol className="space-y-2 text-sm text-muted">
              <li>1. Toque no botão Compartilhar, na barra inferior.</li>
              <li>2. Role e escolha “Adicionar à Tela de Início”.</li>
              <li>3. Toque em “Adicionar”. O app abre em tela cheia.</li>
            </ol>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 p-3.5">
            <Bell className="mt-0.5 h-4 w-4 shrink-0 text-subtle" aria-hidden />
            <p className="text-sm text-muted">
              No iOS, as notificações do Ryse só funcionam depois de instalar o app na
              tela de início.
            </p>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

/* ------------------------------------------------------------ EDITAR DADOS */

function EditSheet({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: SessionUser;
}) {
  const [fullName, setFullName] = useState(user.fullName);
  const [height, setHeight] = useState(user.heightCm ? String(user.heightCm) : '');
  const [goal, setGoal] = useState(user.goal ?? '');
  const [phone, setPhone] = useState(user.phone ?? '');
  const [birthDate, setBirthDate] = useState(user.birthDate ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const save = () => {
    setError(null);
    startSaving(async () => {
      const result = await atualizarPerfil({
        fullName,
        phone,
        birthDate: birthDate || null,
        heightCm: height ? Number(height.replace(',', '.')) : null,
        goal: goal.trim() || null,
      });

      if (!result.ok) {
        setError(result.error ?? 'Não foi possível salvar.');
        return;
      }
      onClose();
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Editar dados"
      description="Alterações no plano clínico são feitas pelo seu profissional."
      footer={
        <Button block onClick={save} disabled={saving} icon={saving ? undefined : Check}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Salvando…
            </>
          ) : (
            'Salvar alterações'
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

        <Field label="Nome completo">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Altura (cm)">
            <Input
              inputMode="numeric"
              value={height}
              placeholder="178"
              onChange={(e) => setHeight(e.target.value.replace(/[^\d]/g, ''))}
            />
          </Field>

          <Field
            label="Data de nascimento"
            hint="Ajusta a meta de hidratação por faixa etária."
          >
            <Input
              type="date"
              value={birthDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Telefone">
          <Input
            type="tel"
            inputMode="tel"
            value={phone}
            placeholder="(11) 90000-0000"
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>

        <Field label="Objetivo" hint="Ex.: hipertrofia limpa, emagrecimento, longevidade.">
          <Textarea rows={2} value={goal} onChange={(e) => setGoal(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}

/* ---------------------------------------------------------- REGISTRAR PESO */

/**
 * Registro rápido de peso.
 *
 * Grava em `body_metrics`, o mesmo lugar do check-in — então o gráfico de
 * evolução e a meta de hidratação se atualizam juntos, sem um segundo campo
 * de peso guardado em outro canto do perfil.
 */
function PesoSheet({
  open,
  onClose,
  atual,
}: {
  open: boolean;
  onClose: () => void;
  atual: number | null;
}) {
  const [peso, setPeso] = useState(atual ? String(atual).replace('.', ',') : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const save = () => {
    const valor = Number(peso.replace(',', '.'));

    if (!peso.trim() || !Number.isFinite(valor)) {
      setError('Digite seu peso em quilos.');
      return;
    }
    if (valor < 20 || valor > 400) {
      setError('O peso deve ficar entre 20 e 400 kg.');
      return;
    }

    setError(null);
    startSaving(async () => {
      const result = await registrarPeso(valor);
      if (!result.ok) {
        setError(result.error ?? 'Não foi possível registrar.');
        return;
      }
      onClose();
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Registrar peso"
      description="Atualiza sua evolução e recalcula a meta diária de água."
      footer={
        <Button block onClick={save} disabled={saving} icon={saving ? undefined : Check}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Salvando…
            </>
          ) : (
            'Salvar peso'
          )}
        </Button>
      }
    >
      <div className="pb-4">
        <label htmlFor="peso-kg" className="mb-1.5 block text-sm font-semibold">
          Peso de hoje
        </label>
        <div className="relative">
          <input
            id="peso-kg"
            inputMode="decimal"
            value={peso}
            onChange={(e) => {
              setPeso(e.target.value.replace(/[^\d.,]/g, ''));
              setError(null);
            }}
            placeholder="78,5"
            aria-invalid={error ? true : undefined}
            className="h-12 w-full rounded-xl border border-line bg-surface pl-3.5 pr-12 text-base font-semibold tabular-nums focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <span
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-subtle"
            aria-hidden
          >
            kg
          </span>
        </div>

        {error && (
          <p role="alert" className="mt-2 text-sm font-medium text-danger">
            {error}
          </p>
        )}

        <p className="mt-2 text-sm text-muted">
          Registrar mais de uma vez no mesmo dia substitui o valor anterior.
        </p>
      </div>
    </Sheet>
  );
}

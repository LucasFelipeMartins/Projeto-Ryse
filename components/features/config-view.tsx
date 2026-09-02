'use client';

import { useState, useTransition } from 'react';
import {
  AlertCircle,
  BrainCircuit,
  Check,
  Loader2,
  Mail,
  Palette,
  Save,
  Shield,
  Stethoscope,
  Users,
} from 'lucide-react';
import { Badge, Button, Card, PageIntro, SectionTitle } from '@/components/ui';
import { Field, Input, ThemePicker } from '@/components/ui/interactive';
import { AvatarUploader } from '@/components/features/avatar-uploader';
import { NotificationPrefsCard } from '@/components/features/notification-prefs';
import { SegurancaCard } from '@/components/features/seguranca-card';
import { PushManager } from '@/components/features/push-manager';
import { SignOutButton } from '@/components/layout/app-shell';
import { atualizarPerfil } from '@/lib/actions/profile';
import type { NotificationPrefsInput } from '@/lib/actions/notifications';
import type { SessionUser } from '@/lib/supabase/server';

/**
 * Configurações do profissional.
 *
 * A tela anterior misturava interruptores que não gravavam nada com cartões
 * de dados inventados ("4 profissionais com acesso", "até 2.000 pacientes").
 * Tudo aqui agora corresponde a algo real: o que aparece é lido do banco, e o
 * que é alterado é gravado.
 *
 * A organização segue a frequência de uso — identidade primeiro, notificações
 * depois, aparência e conta por último —, e cada seção é um bloco com título
 * próprio, em vez de uma lista contínua de linhas indistinguíveis.
 */

export function ConfigView({
  user,
  prefs,
  vapidPublicKey,
  patientCount,
}: {
  user: SessionUser;
  prefs: NotificationPrefsInput;
  vapidPublicKey: string;
  patientCount: number;
}) {
  return (
    <div className="space-y-8">
      <PageIntro
        title="Configurações"
        description="Seu perfil profissional, notificações e preferências do painel."
      />

      <PerfilProfissional user={user} patientCount={patientCount} />

      <section>
        <SectionTitle
          title="Notificações no celular"
          hint="Ative neste aparelho para receber avisos fora do app."
        />
        <PushManager vapidPublicKey={vapidPublicKey} />
      </section>

      {/*
        As categorias clínicas (mudança de protocolo, resultado de exame) são
        do fluxo do paciente — não fazem sentido no painel de quem prescreve.
      */}
      <NotificationPrefsCard initial={prefs} showClinical={false} />

      <SegurancaCard />

      <section>
        <SectionTitle title="Aparência" hint="Vale para este navegador." />
        <Card>
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
              <Palette className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Tema do painel</p>
              <p className="mt-0.5 text-sm text-muted">
                &quot;Sistema&quot; acompanha a configuração do seu aparelho.
              </p>
            </div>
          </div>
          <ThemePicker />
        </Card>
      </section>

      <ContaESeguranca user={user} />

      <p className="pb-2 text-center text-2xs text-subtle">Ryse Pro · versão 1.0.0</p>
    </div>
  );
}

/* -------------------------------------------------------------- PERFIL --- */

function PerfilProfissional({
  user,
  patientCount,
}: {
  user: SessionUser;
  patientCount: number;
}) {
  const [fullName, setFullName] = useState(user.fullName);
  const [specialty, setSpecialty] = useState(user.specialty ?? '');
  const [error, setError] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pending, startTransition] = useTransition();

  const alterado =
    fullName.trim() !== user.fullName || specialty.trim() !== (user.specialty ?? '');

  const salvar = () => {
    setError(null);
    setSalvo(false);

    startTransition(async () => {
      const result = await atualizarPerfil({
        fullName,
        specialty: specialty.trim() || null,
      });

      if (!result.ok) {
        setError(result.error ?? 'Não foi possível salvar.');
        return;
      }
      setSalvo(true);
    });
  };

  return (
    <section>
      <SectionTitle title="Perfil profissional" hint="É o que seus pacientes veem." />

      <Card>
        <AvatarUploader
          userId={user.id}
          name={user.fullName}
          currentUrl={user.avatarUrl}
          size="xl"
        />

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-5">
          {user.crm && (
            <Badge tone="brand" icon={Stethoscope}>
              {user.crm}
            </Badge>
          )}
          <Badge tone="neutral" icon={Users}>
            {patientCount} {patientCount === 1 ? 'paciente' : 'pacientes'}
          </Badge>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Nome de exibição">
            <Input
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setSalvo(false);
                setError(null);
              }}
              autoComplete="name"
            />
          </Field>

          <Field label="Especialidade" hint="Aparece ao lado do seu nome.">
            <Input
              value={specialty}
              onChange={(e) => {
                setSpecialty(e.target.value);
                setSalvo(false);
                setError(null);
              }}
              placeholder="Ex.: Nutrólogo"
            />
          </Field>
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

        <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
          <Button
            icon={pending ? undefined : Save}
            // Sem alteração não há o que salvar: o botão desabilitado diz
            // isso sem precisar de texto explicativo.
            disabled={pending || !alterado}
            onClick={salvar}
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Salvando…
              </>
            ) : (
              'Salvar alterações'
            )}
          </Button>

          {salvo && !alterado && (
            <span
              role="status"
              className="flex items-center gap-1.5 text-sm font-medium text-success"
            >
              <Check className="h-4 w-4" aria-hidden />
              Alterações salvas
            </span>
          )}
        </div>
      </Card>
    </section>
  );
}

/* -------------------------------------------------- CONTA E SEGURANÇA ---- */

function ContaESeguranca({ user }: { user: SessionUser }) {
  const membroDesde = new Date(user.createdAt).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  const linhas = [
    { icon: Mail, label: 'E-mail de acesso', value: user.email },
    { icon: Stethoscope, label: 'Registro profissional', value: user.crm ?? 'Não informado' },
    { icon: Users, label: 'Na plataforma desde', value: membroDesde },
  ];

  return (
    <section>
      <SectionTitle title="Conta" />

      <Card inset className="divide-y divide-line overflow-hidden">
        {linhas.map((linha) => (
          <div key={linha.label} className="flex items-center gap-3 px-4 py-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
              <linha.icon className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{linha.label}</span>
              <span className="mt-0.5 block truncate text-sm text-muted">{linha.value}</span>
            </span>
          </div>
        ))}
      </Card>

      <Card className="mt-3 flex items-start gap-3 border-brand-line bg-brand-soft">
        <BrainCircuit className="mt-0.5 h-4 w-4 shrink-0 text-brand-text" aria-hidden />
        <p className="text-sm text-muted">
          Nenhuma proposta da IA chega ao paciente sem a sua decisão. O que a
          inteligência produz entra na fila de revisão — aprovar, editar ou
          rejeitar continua sendo seu.
        </p>
      </Card>

      <Card className="mt-3 flex items-start gap-3">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-subtle" aria-hidden />
        <p className="text-sm text-muted">
          Você só enxerga dados dos pacientes vinculados a você. O controle é
          aplicado no banco, não na interface.
        </p>
      </Card>

      <Card inset className="mt-3 p-4">
        <SignOutButton />
      </Card>
    </section>
  );
}

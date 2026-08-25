'use client';

import { useState } from 'react';
import {
  BrainCircuit,
  Building2,
  ChevronRight,
  CreditCard,
  Palette,
  Shield,
  Sliders,
  Stethoscope,
  Users,
} from 'lucide-react';
import { Avatar, Badge, Card, PageIntro, SectionTitle } from '@/components/ui';
import { Field, Input, Switch, ThemePicker } from '@/components/ui/interactive';
import { SignOutButton } from '@/components/layout/app-shell';
import type { SessionUser } from '@/lib/supabase/server';

export function ConfigView({ user }: { user: SessionUser }) {
  const [autoNutricao, setAutoNutricao] = useState(true);
  const [autoTreino, setAutoTreino] = useState(true);
  const [autoSuplemento, setAutoSuplemento] = useState(false);
  const [exigirRevisao, setExigirRevisao] = useState(true);

  return (
    <div className="space-y-6">
      <PageIntro
        title="Configurações"
        description="Perfil profissional, autonomia da IA e preferências da clínica."
      />

      {/* ------------------------------------------------ perfil */}
      <Card>
        <div className="flex items-center gap-4">
          <Avatar name={user.fullName} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold tracking-tight">{user.fullName}</h2>
            <p className="truncate text-sm text-muted">{user.specialty ?? user.email}</p>
            {user.crm && (
              <Badge tone="brand" icon={Stethoscope} className="mt-2">
                {user.crm}
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
          <Field label="Nome de exibição">
            <Input defaultValue={user.fullName} />
          </Field>
          <Field label="Especialidade">
            <Input defaultValue={user.specialty ?? ''} placeholder="Ex.: Nutrólogo" />
          </Field>
        </div>
      </Card>

      {/* ------------------------------------------------ autonomia da IA */}
      <section>
        <SectionTitle
          title="Autonomia da inteligência"
          hint="Defina onde a IA pode propor mudanças por conta própria."
        />
        <Card inset className="divide-y divide-line">
          {[
            {
              label: 'Ajustes nutricionais',
              hint: 'Trocas de alimento e calibragem calórica dentro do protocolo.',
              value: autoNutricao,
              set: setAutoNutricao,
            },
            {
              label: 'Progressão de treino',
              hint: 'Cargas, volume e periodização a partir dos logs de sessão.',
              value: autoTreino,
              set: setAutoTreino,
            },
            {
              label: 'Suplementação',
              hint: 'Sugestões a partir de exames laboratoriais.',
              value: autoSuplemento,
              set: setAutoSuplemento,
            },
            {
              label: 'Exigir revisão humana sempre',
              hint: 'Recomendado. Nenhuma proposta chega ao paciente sem sua aprovação.',
              value: exigirRevisao,
              set: setExigirRevisao,
            },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-4 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{s.label}</p>
                <p className="mt-0.5 text-sm text-muted">{s.hint}</p>
              </div>
              <Switch checked={s.value} onChange={s.set} label={s.label} />
            </div>
          ))}
        </Card>

        <Card className="mt-3 flex items-start gap-3 border-brand-line bg-brand-soft">
          <BrainCircuit className="mt-0.5 h-4 w-4 shrink-0 text-brand-text" aria-hidden />
          <p className="text-sm text-muted">
            Com a revisão humana ativa, a IA nunca altera um protocolo sozinha — ela apenas
            enfileira propostas para a sua decisão.
          </p>
        </Card>
      </section>

      {/* ------------------------------------------------ aparência */}
      <section>
        <SectionTitle title="Aparência" />
        <Card>
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-muted">
              <Palette className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <p className="text-sm font-semibold">Tema do painel</p>
          </div>
          <ThemePicker />
        </Card>
      </section>

      {/* ------------------------------------------------ clínica */}
      <section>
        <SectionTitle title="Clínica e cobrança" />
        <Card inset className="divide-y divide-line overflow-hidden">
          {[
            { icon: Building2, label: 'Dados da clínica', hint: 'Razão social, CNPJ e endereço' },
            { icon: Users, label: 'Equipe e permissões', hint: '4 profissionais com acesso' },
            { icon: CreditCard, label: 'Plano da plataforma', hint: 'Ryse Pro · até 2.000 pacientes' },
            { icon: Sliders, label: 'Integrações', hint: 'Laboratórios e wearables' },
            { icon: Shield, label: 'Segurança e LGPD', hint: 'Logs de acesso e consentimentos' },
          ].map((item) => (
            <button
              key={item.label}
              className="tap flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
                <item.icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="mt-0.5 block truncate text-sm text-muted">{item.hint}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
            </button>
          ))}
        </Card>
      </section>

      <Card inset className="p-4">
        <SignOutButton />
      </Card>

      <p className="pb-2 text-center text-2xs text-subtle">Ryse Pro · versão 1.0.0</p>
    </div>
  );
}

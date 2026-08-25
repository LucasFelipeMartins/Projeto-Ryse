'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  HelpCircle,
  LogOut,
  Palette,
  Ruler,
  Share2,
  Shield,
  Smartphone,
  Stethoscope,
  Target,
  UserRoundCog,
} from 'lucide-react';
import { Avatar, Badge, Button, Card, PageIntro, SectionTitle } from '@/components/ui';
import { Sheet, Switch, ThemePicker } from '@/components/ui/interactive';
import { me } from '@/lib/data';

const stats = [
  { icon: Target, label: 'Objetivo', value: me.goal },
  { icon: Ruler, label: 'Altura', value: `${me.height} cm` },
  { icon: Stethoscope, label: 'Médico', value: me.coach },
];

export function PerfilView() {
  const [notifPlano, setNotifPlano] = useState(true);
  const [notifTreino, setNotifTreino] = useState(true);
  const [notifExames, setNotifExames] = useState(false);
  const [install, setInstall] = useState(false);

  return (
    <div className="space-y-6">
      <PageIntro title="Perfil" description="Sua conta, seu plano e as preferências do app." />

      {/* ------------------------------------------------ identidade */}
      <Card>
        <div className="flex items-center gap-4">
          <Avatar name={me.name} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold tracking-tight">{me.name}</h2>
            <p className="text-sm text-muted">ID {me.id} · desde {me.since}</p>
            <Badge tone="brand" className="mt-2">
              {me.plan}
            </Badge>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-2 border-t border-line pt-5 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-2.5 rounded-xl bg-surface-2 px-3 py-2.5">
              <s.icon className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
              <div className="min-w-0">
                <dt className="text-2xs font-medium text-subtle">{s.label}</dt>
                <dd className="truncate text-sm font-semibold">{s.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </Card>

      {/* ------------------------------------------------ aparência */}
      <section>
        <SectionTitle
          title="Aparência"
          hint="O tema acompanha o sistema por padrão."
        />
        <Card>
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-muted">
              <Palette className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <p className="text-sm font-semibold">Tema do aplicativo</p>
          </div>
          <ThemePicker />
        </Card>
      </section>

      {/* ------------------------------------------------ notificações */}
      <section>
        <SectionTitle title="Notificações" />
        <Card inset className="divide-y divide-line">
          {[
            {
              label: 'Alterações no protocolo',
              hint: 'Quando seu médico aprovar um ajuste.',
              value: notifPlano,
              set: setNotifPlano,
            },
            {
              label: 'Lembrete de treino',
              hint: 'Todo dia, 30 minutos antes do horário.',
              value: notifTreino,
              set: setNotifTreino,
            },
            {
              label: 'Resultados de exames',
              hint: 'Assim que um laboratório sincronizar.',
              value: notifExames,
              set: setNotifExames,
            },
          ].map((n) => (
            <div key={n.label} className="flex items-center gap-4 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{n.label}</p>
                <p className="mt-0.5 text-sm text-muted">{n.hint}</p>
              </div>
              <Switch checked={n.value} onChange={n.set} label={n.label} />
            </div>
          ))}
        </Card>
      </section>

      {/* ------------------------------------------------ conta */}
      <section>
        <SectionTitle title="Conta e dados" />
        <Card inset className="divide-y divide-line overflow-hidden">
          {[
            { icon: CreditCard, label: 'Assinatura e pagamento', hint: 'Próxima cobrança em 12 dias' },
            { icon: FileText, label: 'Meus documentos', hint: 'Exames, laudos e receitas' },
            { icon: Download, label: 'Exportar meus dados', hint: 'Arquivo completo em PDF' },
            { icon: Shield, label: 'Privacidade e consentimento', hint: 'LGPD e compartilhamento' },
            { icon: HelpCircle, label: 'Ajuda e suporte', hint: 'Central de atendimento' },
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

      {/* ------------------------------------------------ trocar visão */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/pro" className="tap">
          <Card className="flex h-full items-center gap-3 transition-colors hover:border-line-strong">
            <UserRoundCog className="h-5 w-5 shrink-0 text-brand" aria-hidden />
            <span className="min-w-0 flex-1 text-sm font-semibold">
              Ver como profissional
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
          </Card>
        </Link>

        <Button variant="secondary" icon={LogOut} className="h-full py-4 text-danger">
          Sair da conta
        </Button>
      </div>

      <p className="pb-2 text-center text-2xs text-subtle">
        Ryse · versão 1.0.0 · feito para Android e iOS
      </p>

      {/* ------------------------------------------------ folha de instalação */}
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
              <li>3. Toque em “Adicionar”. O app abre em tela cheia, sem barra do Safari.</li>
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

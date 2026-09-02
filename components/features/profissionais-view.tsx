'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BrainCircuit,
  Check,
  CheckCircle2,
  FileHeart,
  Gauge,
  Loader2,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRoundX,
  Users,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  PageIntro,
  SectionTitle,
} from '@/components/ui';
import { Sheet } from '@/components/ui/interactive';
import {
  chooseProfessional,
  goSolo,
  leaveProfessional,
} from '@/lib/actions/professional-choice';
import type { ProfessionalOption } from '@/lib/queries/professionals';
import { cn } from '@/lib/utils';

const SPEED = {
  alta: {
    label: 'Resposta rápida',
    tone: 'success' as const,
    hint: 'Poucos pacientes — costuma responder no mesmo dia.',
  },
  media: {
    label: 'Resposta média',
    tone: 'warn' as const,
    hint: 'Agenda moderada — normalmente responde em até dois dias.',
  },
  baixa: {
    label: 'Agenda cheia',
    tone: 'danger' as const,
    hint: 'Muitos pacientes — a resposta pode demorar mais.',
  },
};

export function ProfissionaisView({
  professionals,
  currentId,
  choseSolo,
}: {
  professionals: ProfessionalOption[];
  currentId: string | null;
  choseSolo: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<ProfessionalOption | null>(null);
  const [soloOpen, setSoloOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after: () => void) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? 'Não foi possível concluir.');
        return;
      }
      after();
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <PageIntro
        title="Escolher profissional"
        description="Quem vai acompanhar seus exames e ajustar seu protocolo."
      />

      {/* ------------------------------------------------ o que ele faz */}
      <Card className="flex items-start gap-3 border-brand-line bg-brand-soft">
        <Stethoscope className="mt-0.5 h-5 w-5 shrink-0 text-brand-text" aria-hidden />
        <div className="min-w-0 text-sm text-muted">
          <p className="font-semibold text-fg">Para que serve o profissional</p>
          <p className="mt-1.5 leading-relaxed">
            Ele acompanha os exames que você envia, revisa cada sugestão da inteligência
            artificial antes de ela virar parte do seu plano e monta a dieta e a ficha de
            treino. Sem um profissional, nenhuma prescrição é liberada.
          </p>
        </div>
      </Card>

      {/* ------------------------------------------------ estado atual */}
      {currentId && (
        <Card className="flex items-center gap-3 border-success/30 bg-success-soft">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-muted">
            Você já está acompanhado por{' '}
            <strong className="text-fg">
              {professionals.find((p) => p.id === currentId)?.name ?? 'um profissional'}
            </strong>
            . Escolher outro transfere seu acompanhamento.
          </p>
        </Card>
      )}

      {choseSolo && (
        <Card className="flex items-center gap-3">
          <BrainCircuit className="h-5 w-5 shrink-0 text-brand" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-muted">
            Você está no modo <strong className="text-fg">só com a IA</strong>. Pode
            escolher um profissional quando quiser.
          </p>
        </Card>
      )}

      {error && (
        <Card className="flex items-start gap-2.5 border-danger/25 bg-danger-soft">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
          <p className="text-sm font-medium text-danger">{error}</p>
        </Card>
      )}

      {/* ------------------------------------------------ lista */}
      <section>
        {professionals.length > 0 && (
          <SectionTitle
            title="Profissionais disponíveis"
            hint="Quanto menos pacientes, mais rápida tende a ser a resposta."
          />
        )}

        {professionals.length === 0 ? (
          <SemProfissionais />
        ) : (
          <div className="space-y-3">
            {professionals.map((p) => {
              const speed = SPEED[p.responsiveness];
              const isCurrent = p.id === currentId;

              return (
                <Card
                  key={p.id}
                  className={cn('transition-colors', isCurrent && 'border-brand')}
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={p.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-bold">{p.name}</h3>
                        {isCurrent && <Badge tone="brand">Atual</Badge>}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted">
                        {p.specialty ?? 'Profissional de saúde'}
                      </p>
                      {p.crm && <p className="text-2xs text-subtle">{p.crm}</p>}
                    </div>
                  </div>

                  {/* Carga e velocidade: o dado e a leitura dele, lado a lado. */}
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3.5">
                    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
                      <p className="flex items-center gap-1.5 text-2xs font-medium text-subtle">
                        <Users className="h-3 w-3" aria-hidden />
                        Pacientes
                      </p>
                      <p className="mt-1 text-sm font-bold tabular-nums">{p.patientCount}</p>
                    </div>
                    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
                      <p className="flex items-center gap-1.5 text-2xs font-medium text-subtle">
                        <Gauge className="h-3 w-3" aria-hidden />
                        Velocidade
                      </p>
                      <Badge tone={speed.tone} className="mt-1">
                        {speed.label}
                      </Badge>
                    </div>
                  </div>

                  <p className="mt-2 text-sm text-muted">{speed.hint}</p>

                  <Button
                    block
                    className="mt-4"
                    variant={isCurrent ? 'secondary' : 'primary'}
                    disabled={isCurrent || pending}
                    onClick={() => setConfirming(p)}
                  >
                    {isCurrent ? 'Acompanhando você' : 'Escolher este profissional'}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ------------------------------------------------ seguir sozinho */}
      <section>
        <SectionTitle title="Prefere seguir sem profissional?" />
        <Card>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
              <BrainCircuit className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">Só com os resultados da IA</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Você continua enviando exames e recebe a leitura automática deles. O que
                não terá: revisão humana das sugestões, dieta e ficha de treino
                prescritas, e o canal de mensagens.
              </p>
            </div>
          </div>

          <Button
            block
            variant="secondary"
            icon={UserRoundX}
            className="mt-4"
            disabled={pending || choseSolo}
            onClick={() => setSoloOpen(true)}
          >
            {choseSolo ? 'Você já está neste modo' : 'Seguir sem profissional'}
          </Button>
        </Card>
      </section>

      {/* ------------------------------------------------ confirmações */}
      <Sheet
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title="Confirmar escolha"
        description={confirming ? `${confirming.name} passará a acompanhar você.` : undefined}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirming(null)}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={pending}
              onClick={() =>
                confirming &&
                run(() => chooseProfessional(confirming.id), () => setConfirming(null))
              }
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Vinculando…
                </>
              ) : (
                'Confirmar'
              )}
            </Button>
          </div>
        }
      >
        <div className="pb-4">
          <p className="text-sm leading-relaxed text-muted">
            Ao confirmar, {confirming?.name.split(' ')[0]} passa a ver seus exames,
            check-ins e registros de treino — é o que permite acompanhar seu caso. Você
            pode trocar de profissional a qualquer momento.
          </p>

          <ul className="mt-4 space-y-2">
            {[
              'Revisa as sugestões da IA antes de virarem seu plano',
              'Monta sua dieta e sua ficha de treino',
              'Responde suas dúvidas pelo chat',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" strokeWidth={2.5} aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </Sheet>

      <Sheet
        open={soloOpen}
        onClose={() => setSoloOpen(false)}
        title="Seguir sem profissional"
        description="Você pode mudar de ideia quando quiser."
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setSoloOpen(false)}>
              Voltar
            </Button>
            <Button
              className="flex-1"
              disabled={pending}
              onClick={() => run(goSolo, () => setSoloOpen(false))}
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Salvando…
                </>
              ) : (
                'Seguir assim'
              )}
            </Button>
          </div>
        }
      >
        <div className="pb-4">
          <div className="rounded-xl border border-warn/25 bg-warn-soft p-3.5">
            <p className="flex items-start gap-2 text-sm text-warn">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                A leitura automática de exames <strong>não substitui</strong> avaliação
                médica. Ela transcreve valores e sinaliza o que está fora da faixa de
                referência — não diagnostica nem prescreve.
              </span>
            </p>
          </div>

          <p className="mt-4 text-sm text-muted">Neste modo você continua com:</p>
          <ul className="mt-2 space-y-2">
            {[
              'Envio e leitura automática dos seus exames',
              'Registro de peso, hidratação e check-in semanal',
              'Histórico e gráficos de evolução',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" strokeWidth={2.5} aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </Sheet>

      {currentId && (
        <button
          onClick={() => run(leaveProfessional, () => {})}
          disabled={pending}
          className="tap w-full pb-2 text-center text-sm font-semibold text-danger disabled:opacity-50"
        >
          Desfazer vínculo com o profissional atual
        </button>
      )}
    </div>
  );
}

/* --------------------------------------------- AUSÊNCIA DE PROFISSIONAIS -- */

/**
 * Estado vazio do diretório.
 *
 * Um cartão cinza de "nenhum resultado" faria a tela parecer quebrada — e,
 * pior, deixaria o paciente achando que o acompanhamento parou. Aqui a
 * ausência é tratada como **transição**, não como falha: a mensagem afirma
 * que a IA assume o monitoramento, e os cartões abaixo mostram concretamente
 * o que continua funcionando enquanto isso.
 */
function SemProfissionais() {
  const garantias = [
    {
      icon: Activity,
      title: 'Seus dados seguem sendo lidos',
      text: 'Peso, medidas, treinos, refeições e check-ins continuam alimentando sua evolução.',
    },
    {
      icon: FileHeart,
      title: 'Exames continuam analisados',
      text: 'Os documentos que você enviar passam pela leitura automática, com marcadores e resumo.',
    },
    {
      icon: Sparkles,
      title: 'Relatórios e planos por IA',
      text: 'Dieta, ficha de treino e relatórios das áreas seguem disponíveis para você gerar.',
    },
  ];

  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden border-line-strong bg-ink p-6 text-ink-on sm:p-8">
        <span
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand/25 blur-3xl"
          aria-hidden
        />

        <div className="relative">
          <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-brand-on">
            <BrainCircuit className="h-7 w-7" aria-hidden />
          </span>

          <p className="max-w-xl text-balance text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
            Profissionais em breve, no momento você será monitorado por uma IA
            treinada e capacitada para isso.
          </p>

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-on/70 sm:text-base">
            Estamos finalizando o credenciamento da equipe clínica. Até lá, seu
            acompanhamento não para: a inteligência da plataforma segue lendo seus
            registros e gerando orientações personalizadas.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <ButtonLink href="/inicio" iconRight={ArrowRight} className="w-full sm:w-auto">
              Continuar para o meu painel
            </ButtonLink>
            <span className="hidden text-sm text-ink-on/50 sm:inline">
              Avisamos assim que houver profissionais disponíveis
            </span>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        {garantias.map((g) => (
          <Card key={g.title} className="h-full">
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
              <g.icon className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="text-sm font-bold">{g.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{g.text}</p>
          </Card>
        ))}
      </div>

      <Card className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-subtle" aria-hidden />
        <p className="text-sm text-muted">
          A análise por IA é uma orientação de partida e não substitui avaliação
          profissional. Assim que a equipe estiver disponível, você poderá vincular
          seu acompanhamento a um profissional por aqui.
        </p>
      </Card>
    </div>
  );
}

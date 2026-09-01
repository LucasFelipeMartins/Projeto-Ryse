'use client';

import { useState, useTransition } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  KeyRound,
  Loader2,
  RotateCcw,
  ShieldAlert,
  Stethoscope,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import { Avatar, Badge, Button, Card, EmptyState, PageIntro, SectionTitle, Stat } from '@/components/ui';
import { Field, Input, Sheet } from '@/components/ui/interactive';
import {
  criarProfissional,
  redefinirSenhaProvisoria,
  revogarAcessoProfissional,
} from '@/lib/actions/admin';
import type { ProfissionalAdminView, ResumoAdmin } from '@/lib/queries/admin';
import { cn } from '@/lib/utils';

/**
 * Área administrativa.
 *
 * Uma coisa só: gerir quem tem acesso profissional. Não é um painel de
 * métricas nem um segundo dashboard — o que cabe aqui é o que só o dono da
 * operação pode fazer.
 *
 * A senha provisória aparece **uma vez**, logo depois de criada, e some ao
 * fechar. Guardá-la em algum lugar para reexibir depois significaria manter
 * uma credencial em claro no banco; se for perdida, o caminho é gerar outra.
 */

export function AdminView({
  profissionais,
  resumo,
  adminName,
}: {
  profissionais: ProfissionalAdminView[];
  resumo: ResumoAdmin;
  adminName: string;
}) {
  const [novoOpen, setNovoOpen] = useState(false);
  const [credencial, setCredencial] = useState<{
    email: string;
    senha: string;
    reaproveitada: boolean;
  } | null>(null);

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Administração"
        title="Equipe"
        description={`Cadastre e gerencie os profissionais da clínica, ${adminName.split(' ')[0]}.`}
        action={
          <Button icon={UserPlus} onClick={() => setNovoOpen(true)}>
            Novo profissional
          </Button>
        }
      />

      {/* ------------------------------------------------ indicadores */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Profissionais" value={String(resumo.profissionais)} icon={Stethoscope} />
        <Stat label="Pacientes" value={String(resumo.pacientes)} icon={Users} />
        <Stat
          label="Sem profissional"
          value={String(resumo.pacientesSemProfissional)}
          delta={
            resumo.pacientesSemProfissional > 0 ? 'Aguardando vínculo' : 'Todos vinculados'
          }
          up={resumo.pacientesSemProfissional === 0}
        />
        <Stat
          label="1º acesso pendente"
          value={String(resumo.primeirosAcessosPendentes)}
          alert={resumo.primeirosAcessosPendentes > 0}
          delta={
            resumo.primeirosAcessosPendentes > 0 ? 'Senha provisória ativa' : 'Nenhum'
          }
        />
      </div>

      {/* ------------------------------------------------ lista */}
      <section>
        <SectionTitle
          title="Profissionais cadastrados"
          hint="Contas com acesso à área clínica."
        />

        {profissionais.length === 0 ? (
          <Card inset>
            <EmptyState
              icon={Stethoscope}
              title="Nenhum profissional ainda"
              description="Cadastre o primeiro para que os pacientes possam escolher quem os acompanha."
              action={
                <Button icon={UserPlus} onClick={() => setNovoOpen(true)}>
                  Novo profissional
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {profissionais.map((p) => (
              <LinhaProfissional
                key={p.id}
                profissional={p}
                onSenhaGerada={(senha) =>
                  setCredencial({ email: p.email, senha, reaproveitada: true })
                }
              />
            ))}
          </div>
        )}
      </section>

      <NovoProfissionalSheet
        open={novoOpen}
        onClose={() => setNovoOpen(false)}
        onCriado={(dados) => {
          setNovoOpen(false);
          setCredencial(dados);
        }}
      />

      <CredencialSheet
        credencial={credencial}
        onClose={() => setCredencial(null)}
      />
    </div>
  );
}

/* ------------------------------------------------------------- LINHA ---- */

function LinhaProfissional({
  profissional,
  onSenhaGerada,
}: {
  profissional: ProfissionalAdminView;
  onSenhaGerada: (senha: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [confirmarRevogar, setConfirmarRevogar] = useState(false);
  const [pending, startTransition] = useTransition();

  const novaSenha = () => {
    setError(null);
    startTransition(async () => {
      const result = await redefinirSenhaProvisoria(profissional.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSenhaGerada(result.senha);
    });
  };

  const revogar = () => {
    setError(null);
    startTransition(async () => {
      const result = await revogarAcessoProfissional(profissional.id);
      if (!result.ok) {
        setError(result.error ?? 'Não foi possível revogar.');
        return;
      }
      setConfirmarRevogar(false);
    });
  };

  return (
    <Card>
      <div className="flex items-start gap-3">
        <Avatar
          name={profissional.fullName}
          src={profissional.avatarUrl}
          size="md"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-bold">{profissional.fullName}</h3>
            {profissional.pendingFirstAccess && (
              <Badge tone="warn" icon={KeyRound}>
                1º acesso pendente
              </Badge>
            )}
          </div>

          <p className="mt-0.5 truncate text-sm text-muted">{profissional.email}</p>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-subtle">
            {profissional.specialty && <span>{profissional.specialty}</span>}
            {profissional.crm && <span>{profissional.crm}</span>}
            <span>
              {profissional.patientCount}{' '}
              {profissional.patientCount === 1 ? 'paciente' : 'pacientes'}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl border border-danger/25 bg-danger-soft p-3 text-sm font-medium text-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3.5">
        <Button
          size="sm"
          variant="secondary"
          icon={pending ? undefined : RotateCcw}
          disabled={pending}
          onClick={novaSenha}
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Aguarde
            </>
          ) : (
            'Nova senha provisória'
          )}
        </Button>

        {confirmarRevogar ? (
          <>
            <Button size="sm" variant="danger" disabled={pending} onClick={revogar}>
              Confirmar revogação
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => setConfirmarRevogar(false)}
            >
              Cancelar
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            icon={UserMinus}
            disabled={pending}
            onClick={() => setConfirmarRevogar(true)}
          >
            Revogar acesso
          </Button>
        )}
      </div>

      {confirmarRevogar && (
        <p className="mt-2 text-sm text-muted">
          A conta vira paciente e os {profissional.patientCount} paciente(s) dela
          voltam para a tela de escolha. O histórico é preservado.
        </p>
      )}
    </Card>
  );
}

/* ----------------------------------------------------- NOVO PROFISSIONAL */

function NovoProfissionalSheet({
  open,
  onClose,
  onCriado,
}: {
  open: boolean;
  onClose: () => void;
  onCriado: (dados: { email: string; senha: string; reaproveitada: boolean }) => void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [crm, setCrm] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const limpar = () => {
    setFullName('');
    setEmail('');
    setSpecialty('');
    setCrm('');
    setSenha('');
    setError(null);
  };

  const salvar = () => {
    setError(null);

    startTransition(async () => {
      const result = await criarProfissional({
        fullName,
        email,
        specialty,
        crm,
        senhaProvisoria: senha,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onCriado({
        email: result.data.email,
        senha: result.data.senhaProvisoria,
        reaproveitada: result.data.reaproveitada,
      });
      limpar();
    });
  };

  return (
    <Sheet
      open={open}
      onClose={() => {
        limpar();
        onClose();
      }}
      title="Novo profissional"
      description="A conta já nasce confirmada e com acesso à área clínica."
      footer={
        <Button block onClick={salvar} disabled={pending} icon={pending ? undefined : Check}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Criando…
            </>
          ) : (
            'Criar acesso'
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
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Dra. Ana Ribeiro"
            autoComplete="off"
          />
        </Field>

        <Field label="E-mail" hint="É por ele que a pessoa entra em /pro/entrar.">
          <Input
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ana@clinica.com"
            autoComplete="off"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Especialidade">
            <Input
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="Nutricionista"
            />
          </Field>

          <Field label="Registro profissional" hint="CRM, CRN, CREF…">
            <Input
              value={crm}
              onChange={(e) => setCrm(e.target.value)}
              placeholder="CRN-3 12345"
            />
          </Field>
        </div>

        <Field
          label="Senha provisória"
          hint="Deixe em branco para o sistema gerar uma. Ela vale só até o primeiro acesso."
        >
          <Input
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="gerada automaticamente"
            autoComplete="off"
          />
        </Field>

        <p className="flex items-start gap-2 rounded-xl border border-line bg-surface-2 p-3 text-sm text-muted">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-subtle" aria-hidden />
          No primeiro acesso, o profissional é obrigado a definir a própria senha
          antes de ver qualquer tela. A provisória deixa de valer nesse momento.
        </p>
      </div>
    </Sheet>
  );
}

/* -------------------------------------------------------- CREDENCIAL ---- */

/**
 * Exibição única da senha provisória.
 *
 * Ela não é guardada em lugar nenhum — nem no banco, nem no estado do
 * servidor. Fechar esta folha a descarta de vez, e é isso mesmo: manter uma
 * credencial em claro para poder reexibi-la depois seria trocar conveniência
 * por risco. Se sumir, gera-se outra.
 */
function CredencialSheet({
  credencial,
  onClose,
}: {
  credencial: { email: string; senha: string; reaproveitada: boolean } | null;
  onClose: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  if (!credencial) return null;

  const texto = `Acesso Ryse\nEndereço: /pro/entrar\nE-mail: ${credencial.email}\nSenha provisória: ${credencial.senha}`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sem permissão de área de transferência: o texto continua na tela.
      setCopiado(false);
    }
  };

  return (
    <Sheet
      open
      onClose={() => {
        setCopiado(false);
        onClose();
      }}
      title={credencial.reaproveitada ? 'Senha redefinida' : 'Acesso criado'}
      description="Anote agora — esta senha não será exibida de novo."
      footer={
        <Button block variant="secondary" onClick={onClose}>
          Já anotei
        </Button>
      }
    >
      <div className="space-y-4 pb-4">
        <div className="rounded-xl border border-brand-line bg-brand-soft p-4">
          <p className="text-2xs font-bold uppercase tracking-wider text-brand-text">
            Entrar em /pro/entrar
          </p>

          <dl className="mt-3 space-y-2.5">
            <div>
              <dt className="text-2xs font-medium text-subtle">E-mail</dt>
              <dd className="mt-0.5 break-all font-mono text-sm font-semibold">
                {credencial.email}
              </dd>
            </div>
            <div>
              <dt className="text-2xs font-medium text-subtle">Senha provisória</dt>
              <dd className="mt-0.5 break-all font-mono text-base font-bold tracking-wide">
                {credencial.senha}
              </dd>
            </div>
          </dl>
        </div>

        <Button
          block
          variant="secondary"
          icon={copiado ? Check : Copy}
          onClick={copiar}
          className={cn(copiado && 'text-success')}
        >
          {copiado ? 'Copiado' : 'Copiar dados de acesso'}
        </Button>

        <p className="flex items-start gap-2 rounded-xl border border-warn/25 bg-warn-soft p-3 text-sm text-warn">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Envie por um canal que você considere seguro. No primeiro acesso o
          sistema exige a troca, então a senha some de circulação logo em seguida.
        </p>
      </div>
    </Sheet>
  );
}

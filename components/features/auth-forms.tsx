'use client';

import Link from 'next/link';
import { useActionState, useId, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Stethoscope,
  User,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import {
  requestPasswordReset,
  signIn,
  signInProfessional,
  signUp,
  updatePassword,
  type AuthState,
} from '@/lib/actions/auth';
import { cn } from '@/lib/utils';

/**
 * Portal de acesso.
 *
 * Cliente e profissional têm telas próprias, e a diferença não é só o texto:
 * cada uma envia para uma Server Action que **recusa** o papel errado. Os
 * links auxiliares (cadastro, recuperação, troca de área) também mudam, para
 * que ninguém saia de uma área e caia na outra sem perceber.
 */
export type Portal = 'paciente' | 'profissional';

const PORTAL_LINKS = {
  paciente: { login: '/entrar', reset: '/recuperar-senha' },
  profissional: { login: '/pro/entrar', reset: '/pro/recuperar-senha' },
} as const;

/* ------------------------------------------------------------- PRIMITIVAS */

function Alert({ kind, children }: { kind: 'error' | 'ok'; children: React.ReactNode }) {
  const Icon = kind === 'error' ? AlertCircle : CheckCircle2;
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={cn(
        'mb-5 flex items-start gap-2.5 rounded-xl border p-3.5 text-sm',
        kind === 'error'
          ? 'border-danger/25 bg-danger-soft text-danger'
          : 'border-success/25 bg-success-soft text-success',
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p className="leading-relaxed">{children}</p>
    </div>
  );
}

function TextField({
  label,
  name,
  type = 'text',
  icon: Icon,
  defaultValue,
  autoComplete,
  placeholder,
  inputMode,
  required = true,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  icon: LucideIcon;
  defaultValue?: string;
  autoComplete?: string;
  placeholder?: string;
  inputMode?: 'email' | 'text';
  required?: boolean;
  hint?: string;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';
  const resolvedType = isPassword && visible ? 'text' : type;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <Icon
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
          aria-hidden
        />
        <input
          id={id}
          name={name}
          type={resolvedType}
          inputMode={inputMode}
          required={required}
          defaultValue={defaultValue}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={cn(
            'h-12 w-full rounded-xl border border-line bg-surface pl-10 text-base',
            'placeholder:text-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30',
            isPassword ? 'pr-12' : 'pr-3.5',
          )}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
            className="tap absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-subtle hover:text-fg"
          >
            {visible ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
          </button>
        )}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="tap flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-base font-semibold text-brand-on shadow-brand disabled:opacity-60"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Aguarde
        </>
      ) : (
        <>
          {children}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </>
      )}
    </button>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-muted">{subtitle}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ LOGIN */

/** Mensagens dos retornos de e-mail que chegam via ?erro= */
const LINK_ERRORS: Record<string, string> = {
  link_invalido: 'Esse link não é válido. Peça um novo e-mail.',
  link_expirado: 'O link expirou. Peça uma nova redefinição de senha.',
  perfil_ausente:
    'Sua conta existe, mas o perfil não foi encontrado. Entre novamente — se persistir, fale com a clínica.',
};

export function SignInForm({
  proximo = '',
  erro,
  portal = 'paciente',
}: {
  proximo?: string;
  erro?: string;
  portal?: Portal;
}) {
  const isPro = portal === 'profissional';
  const [state, action] = useActionState<AuthState, FormData>(
    isPro ? signInProfessional : signIn,
    {},
  );
  const linkError = erro ? LINK_ERRORS[erro] : undefined;

  return (
    <>
      {isPro && (
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-line bg-brand-soft px-3 py-1.5 text-sm font-semibold text-brand-text">
          <Stethoscope className="h-4 w-4" aria-hidden />
          Área do profissional
        </div>
      )}

      <Header
        title={isPro ? 'Entrar como profissional' : 'Entrar'}
        subtitle={
          isPro
            ? 'Acesse seu painel, seus pacientes e a fila de revisão clínica.'
            : 'Acesse seu plano de nutrição, treino e exames.'
        }
      />

      {(state.error || linkError) && (
        <Alert kind="error">{state.error ?? linkError}</Alert>
      )}

      <form action={action} className="space-y-4">
        <input type="hidden" name="proximo" value={proximo} />

        <TextField
          label="E-mail"
          name="email"
          type="email"
          inputMode="email"
          icon={Mail}
          autoComplete="email"
          placeholder="voce@email.com"
          defaultValue={state.values?.email}
        />

        <div>
          <TextField
            label="Senha"
            name="password"
            type="password"
            icon={Lock}
            autoComplete="current-password"
            placeholder="••••••••"
          />
          <div className="mt-2 flex justify-end">
            <Link
              href={PORTAL_LINKS[portal].reset}
              className="text-sm font-semibold text-brand-text hover:underline"
            >
              Esqueci minha senha
            </Link>
          </div>
        </div>

        <Submit>Entrar</Submit>
      </form>

      {isPro ? (
        <div className="mt-8 space-y-3 border-t border-line pt-6">
          <p className="text-center text-sm text-muted">
            Contas de profissional são criadas pela administração da clínica.
          </p>
          <Link
            href="/entrar"
            className="tap flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-semibold text-muted transition-colors hover:text-fg"
          >
            <UserRound className="h-4 w-4" aria-hidden />
            Sou cliente — entrar no app
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-8 text-center text-sm text-muted">
            Ainda não tem conta?{' '}
            <Link href="/cadastrar" className="font-semibold text-brand-text hover:underline">
              Criar conta
            </Link>
          </p>

          <div className="mt-6 border-t border-line pt-6">
            <Link
              href="/pro/entrar"
              className="tap flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-semibold text-muted transition-colors hover:text-fg"
            >
              <Stethoscope className="h-4 w-4" aria-hidden />
              Sou profissional
            </Link>
          </div>
        </>
      )}
    </>
  );
}

/* --------------------------------------------------------------- CADASTRO */

export function SignUpForm() {
  const [state, action] = useActionState<AuthState, FormData>(signUp, {});

  // Depois do "confira seu e-mail" não faz sentido manter o formulário.
  if (state.notice) {
    return (
      <>
        <Header
          title="Confira seu e-mail"
          subtitle="Falta só um passo para ativar sua conta."
        />
        <Alert kind="ok">{state.notice}</Alert>
        <Link
          href="/entrar"
          className="tap flex h-12 w-full items-center justify-center rounded-xl border border-line bg-surface text-sm font-semibold"
        >
          Voltar para o login
        </Link>
      </>
    );
  }

  return (
    <>
      <Header
        title="Criar conta"
        subtitle="Comece a acompanhar sua nutrição e seus treinos."
      />

      {state.error && <Alert kind="error">{state.error}</Alert>}

      <form action={action} className="space-y-4">
        <TextField
          label="Nome completo"
          name="full_name"
          icon={User}
          autoComplete="name"
          placeholder="Como você quer ser chamado"
          defaultValue={state.values?.full_name}
        />

        <TextField
          label="E-mail"
          name="email"
          type="email"
          inputMode="email"
          icon={Mail}
          autoComplete="email"
          placeholder="voce@email.com"
          defaultValue={state.values?.email}
        />

        <TextField
          label="Senha"
          name="password"
          type="password"
          icon={Lock}
          autoComplete="new-password"
          placeholder="••••••••"
          hint="Mínimo de 8 caracteres."
        />

        <TextField
          label="Confirmar senha"
          name="confirm"
          type="password"
          icon={Lock}
          autoComplete="new-password"
          placeholder="••••••••"
        />

        <Submit>Criar conta</Submit>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Ao criar a conta você concorda com o tratamento dos seus dados de saúde
        conforme a LGPD.
      </p>

      <p className="mt-6 text-center text-sm text-muted">
        Já tem conta?{' '}
        <Link href="/entrar" className="font-semibold text-brand-text hover:underline">
          Entrar
        </Link>
      </p>
    </>
  );
}

/* ----------------------------------------------------- RECUPERAR A SENHA */

export function ResetRequestForm({ portal = 'paciente' }: { portal?: Portal }) {
  const [state, action] = useActionState<AuthState, FormData>(requestPasswordReset, {});

  return (
    <>
      <Header
        title="Recuperar senha"
        subtitle={
          portal === 'profissional'
            ? 'Enviaremos um link para você redefinir a senha do painel.'
            : 'Enviaremos um link para você definir uma nova senha.'
        }
      />

      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.notice && <Alert kind="ok">{state.notice}</Alert>}

      {!state.notice && (
        <form action={action} className="space-y-4">
          <input type="hidden" name="portal" value={portal} />
          <TextField
            label="E-mail da conta"
            name="email"
            type="email"
            inputMode="email"
            icon={Mail}
            autoComplete="email"
            placeholder="voce@email.com"
            defaultValue={state.values?.email}
          />
          <Submit>Enviar link</Submit>
        </form>
      )}

      <p className="mt-8 text-center text-sm text-muted">
        Lembrou a senha?{' '}
        <Link
          href={PORTAL_LINKS[portal].login}
          className="font-semibold text-brand-text hover:underline"
        >
          Voltar para o login
        </Link>
      </p>
    </>
  );
}

/* ------------------------------------------------------------ NOVA SENHA */

export function NewPasswordForm({ portal = 'paciente' }: { portal?: Portal }) {
  const [state, action] = useActionState<AuthState, FormData>(updatePassword, {});

  return (
    <>
      <Header
        title="Definir nova senha"
        subtitle="Escolha uma senha que você ainda não usou aqui."
      />

      {state.error && <Alert kind="error">{state.error}</Alert>}

      <form action={action} className="space-y-4">
        <TextField
          label="Nova senha"
          name="password"
          type="password"
          icon={Lock}
          autoComplete="new-password"
          placeholder="••••••••"
          hint="Mínimo de 8 caracteres."
        />
        <TextField
          label="Confirmar nova senha"
          name="confirm"
          type="password"
          icon={Lock}
          autoComplete="new-password"
          placeholder="••••••••"
        />
        <Submit>Salvar senha</Submit>
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        <Link
          href={PORTAL_LINKS[portal].login}
          className="font-semibold text-brand-text hover:underline"
        >
          Voltar para o login
        </Link>
      </p>
    </>
  );
}

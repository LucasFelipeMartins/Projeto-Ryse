'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
  User,
  type LucideIcon,
} from 'lucide-react';
import {
  requestPasswordReset,
  signIn,
  signUp,
  updatePassword,
  type AuthState,
} from '@/lib/actions/auth';
import { cn } from '@/lib/utils';

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

export function SignInForm() {
  const params = useSearchParams();
  const next = params.get('proximo') ?? '';
  const [state, action] = useActionState<AuthState, FormData>(signIn, {});

  return (
    <>
      <Header title="Entrar" subtitle="Acesse seu plano de nutrição, treino e exames." />

      {state.error && <Alert kind="error">{state.error}</Alert>}

      <form action={action} className="space-y-4">
        <input type="hidden" name="proximo" value={next} />

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
              href="/recuperar-senha"
              className="text-sm font-semibold text-brand-text hover:underline"
            >
              Esqueci minha senha
            </Link>
          </div>
        </div>

        <Submit>Entrar</Submit>
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        Ainda não tem conta?{' '}
        <Link href="/cadastrar" className="font-semibold text-brand-text hover:underline">
          Criar conta
        </Link>
      </p>
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

export function ResetRequestForm() {
  const [state, action] = useActionState<AuthState, FormData>(requestPasswordReset, {});

  return (
    <>
      <Header
        title="Recuperar senha"
        subtitle="Enviaremos um link para você definir uma nova senha."
      />

      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.notice && <Alert kind="ok">{state.notice}</Alert>}

      {!state.notice && (
        <form action={action} className="space-y-4">
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
        <Link href="/entrar" className="font-semibold text-brand-text hover:underline">
          Voltar para o login
        </Link>
      </p>
    </>
  );
}

/* ------------------------------------------------------------ NOVA SENHA */

export function NewPasswordForm() {
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
        <Link href="/entrar" className="font-semibold text-brand-text hover:underline">
          Voltar para o login
        </Link>
      </p>
    </>
  );
}

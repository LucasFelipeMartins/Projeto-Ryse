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
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MailCheck,
} from 'lucide-react';
import {
  definirPrimeiraSenha,
  reenviarConfirmacao,
  type PasswordState,
} from '@/lib/actions/account';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------ PRIMITIVAS */

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

function PasswordField({
  label,
  name,
  autoComplete,
  hint,
  onChange,
}: {
  label: string;
  name: string;
  autoComplete: string;
  hint?: string;
  onChange?: (v: string) => void;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <Lock
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
          aria-hidden
        />
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          required
          autoComplete={autoComplete}
          placeholder="••••••••"
          onChange={(e) => onChange?.(e.target.value)}
          className="h-12 w-full rounded-xl border border-line bg-surface pl-10 pr-12 text-base placeholder:text-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
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
      </div>
      {hint && <p className="mt-1.5 text-sm text-muted">{hint}</p>}
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

/* ------------------------------------------------- FORÇA DA SENHA ------- */

/**
 * Medidor de força.
 *
 * Mede o que de fato importa — comprimento e variedade de caracteres — e
 * mostra o resultado enquanto a pessoa digita. Não bloqueia nada por si só:
 * a regra que vale está no servidor. Aqui a função é dar retorno imediato,
 * em vez de recusar o formulário depois de enviado.
 */
function ForcaDaSenha({ senha }: { senha: string }) {
  if (!senha) return null;

  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) =>
    re.test(senha),
  ).length;

  const pontos =
    (senha.length >= 8 ? 1 : 0) +
    (senha.length >= 12 ? 1 : 0) +
    (classes >= 2 ? 1 : 0) +
    (classes >= 3 ? 1 : 0);

  const niveis = [
    { label: 'Muito fraca', cor: 'bg-danger', texto: 'text-danger' },
    { label: 'Fraca', cor: 'bg-danger', texto: 'text-danger' },
    { label: 'Razoável', cor: 'bg-warn', texto: 'text-warn' },
    { label: 'Boa', cor: 'bg-success', texto: 'text-success' },
    { label: 'Forte', cor: 'bg-success', texto: 'text-success' },
  ];

  const nivel = niveis[pontos];

  return (
    <div className="mt-2">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              i < pontos ? nivel.cor : 'bg-surface-3',
            )}
          />
        ))}
      </div>
      <p className={cn('mt-1.5 text-sm font-medium', nivel.texto)}>
        Força: {nivel.label}
      </p>
    </div>
  );
}

/* --------------------------------------------------- PRIMEIRA SENHA ----- */

export function PrimeiraSenhaForm({ email }: { email: string }) {
  const [state, action] = useActionState<PasswordState, FormData>(
    definirPrimeiraSenha,
    {},
  );
  const [senha, setSenha] = useState('');

  return (
    <>
      <div className="mb-6">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-brand-on">
          <KeyRound className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="text-3xl font-bold tracking-tight">Defina sua senha</h1>
        <p className="mt-2 text-muted">
          A senha que você recebeu era provisória. Escolha a sua para continuar.
        </p>
      </div>

      {state.error && <Alert kind="error">{state.error}</Alert>}

      <div className="mb-5 rounded-xl border border-line bg-surface-2 p-3.5">
        <p className="text-2xs font-medium text-subtle">Conta</p>
        <p className="mt-0.5 break-all font-mono text-sm font-semibold">{email}</p>
      </div>

      <form action={action} className="space-y-4">
        <div>
          <PasswordField
            label="Nova senha"
            name="password"
            autoComplete="new-password"
            hint="Mínimo de 8 caracteres, misturando letras e números."
            onChange={setSenha}
          />
          <ForcaDaSenha senha={senha} />
        </div>

        <PasswordField
          label="Confirmar nova senha"
          name="confirm"
          autoComplete="new-password"
        />

        <Submit>Salvar e entrar</Submit>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        A partir de agora, é esta senha que vale. A provisória deixa de funcionar.
      </p>
    </>
  );
}

/* ------------------------------------------------ CONFIRMAR E-MAIL ------ */

export function VerificarEmailView({ email }: { email: string }) {
  const [state, action] = useActionState<PasswordState, FormData>(
    reenviarConfirmacao,
    {},
  );

  return (
    <>
      <div className="mb-6">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-brand-on">
          <MailCheck className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="text-3xl font-bold tracking-tight">Confirme seu e-mail</h1>
        <p className="mt-2 text-muted">
          Enviamos um link de confirmação. Ele precisa ser aberto antes do
          primeiro acesso.
        </p>
      </div>

      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.notice && <Alert kind="ok">{state.notice}</Alert>}

      <ol className="mb-6 space-y-2.5">
        {[
          'Abra a caixa de entrada do e-mail cadastrado.',
          'Procure a mensagem do Ryse — confira também o spam e as promoções.',
          'Toque no botão de confirmação. Você volta para cá já liberado.',
        ].map((passo, i) => (
          <li key={passo} className="flex gap-3 rounded-xl border border-line bg-surface p-3.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-2xs font-bold tabular-nums text-muted">
              {i + 1}
            </span>
            <p className="text-sm leading-relaxed text-muted">{passo}</p>
          </li>
        ))}
      </ol>

      <form action={action} className="space-y-4 border-t border-line pt-6">
        <p className="text-sm font-semibold">Não recebeu?</p>

        <div>
          <label htmlFor="email-reenvio" className="mb-1.5 block text-sm text-muted">
            E-mail do cadastro
          </label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
              aria-hidden
            />
            <input
              id="email-reenvio"
              name="email"
              type="email"
              inputMode="email"
              required
              defaultValue={email}
              autoComplete="email"
              placeholder="voce@email.com"
              className="h-12 w-full rounded-xl border border-line bg-surface pl-10 pr-3.5 text-base placeholder:text-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>
        </div>

        <Submit>Reenviar confirmação</Submit>
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        Já confirmou?{' '}
        <Link href="/entrar" className="font-semibold text-brand-text hover:underline">
          Entrar
        </Link>
      </p>
    </>
  );
}

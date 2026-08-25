import Link from 'next/link';
import { Apple, ArrowRight, Dumbbell, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { RyseLogo } from '@/components/layout/brand';
import { ThemeToggle } from '@/components/ui/interactive';

export const metadata = { title: 'Entrar' };

const pillars = [
  { icon: Apple, title: 'Nutrição viva', text: 'Cardápio que se ajusta ao seu check-in.' },
  { icon: Dumbbell, title: 'Treino guiado', text: 'Periodização com registro de carga.' },
  { icon: ShieldCheck, title: 'Revisão humana', text: 'Todo ajuste passa pelo seu médico.' },
];

export default function LoginPage() {
  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-2">
      {/* -------------------------------------------- painel da marca */}
      <section className="relative hidden overflow-hidden bg-ink p-12 text-ink-on lg:flex lg:flex-col lg:justify-between">
        <span
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand/25 blur-3xl"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-brand/10 blur-3xl"
          aria-hidden
        />

        <RyseLogo size="lg" className="relative" />

        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-tight tracking-tight text-balance">
            Seu protocolo deixa de ser um PDF parado.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-on/65">
            O Ryse cruza seus check-ins, treinos e exames — e só entrega um ajuste depois
            que um profissional aprova.
          </p>

          <ul className="mt-10 space-y-4">
            {pillars.map((p) => (
              <li key={p.title} className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-on/[0.08] text-brand">
                  <p.icon className="h-5 w-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-bold">{p.title}</span>
                  <span className="mt-0.5 block text-sm text-ink-on/60">{p.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-ink-on/40">
          © 2026 Ryse · Todos os dados protegidos pela LGPD
        </p>
      </section>

      {/* -------------------------------------------- formulário */}
      <section className="flex min-h-dvh flex-col px-6 py-8 pt-safe sm:px-10 lg:min-h-0 lg:justify-center">
        <div className="flex items-center justify-between lg:hidden">
          <RyseLogo />
          <ThemeToggle />
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10 lg:py-0">
          <div className="hidden justify-end lg:flex">
            <ThemeToggle />
          </div>

          <h1 className="text-3xl font-bold tracking-tight">Entrar</h1>
          <p className="mt-2 text-muted">
            Acesse seu plano de nutrição, treino e exames.
          </p>

          <form className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">E-mail</span>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
                  aria-hidden
                />
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="voce@email.com"
                  className="h-12 w-full rounded-xl border border-line bg-surface pl-10 pr-3.5 text-base placeholder:text-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
            </label>

            <label className="block">
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-sm font-semibold">Senha</span>
                <button
                  type="button"
                  className="text-sm font-semibold text-brand-text hover:underline"
                >
                  Esqueci
                </button>
              </div>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="h-12 w-full rounded-xl border border-line bg-surface px-3.5 text-base placeholder:text-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </label>

            <Link
              href="/inicio"
              className="tap flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-base font-semibold text-brand-on shadow-brand"
            >
              Entrar
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-sm text-subtle">ou</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <Link
            href="/pro"
            className="tap flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-semibold transition-colors hover:border-line-strong"
          >
            <Sparkles className="h-4 w-4 text-brand" aria-hidden />
            Entrar como profissional
          </Link>

          <p className="mt-8 text-center text-sm text-muted">
            Ainda não tem conta?{' '}
            <button className="font-semibold text-brand-text hover:underline">
              Falar com a clínica
            </button>
          </p>
        </div>

        <p className="pb-safe text-center text-2xs text-subtle lg:hidden">
          © 2026 Ryse · Protegido pela LGPD
        </p>
      </section>
    </main>
  );
}

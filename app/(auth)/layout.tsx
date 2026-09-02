import { Apple, Dumbbell, ShieldCheck } from 'lucide-react';
import { RyseLogo } from '@/components/layout/brand';
import { ThemeToggle } from '@/components/ui/interactive';
import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/supabase/env';

const pillars = [
  { icon: Apple, title: 'Nutrição viva', text: 'Cardápio que se ajusta ao seu check-in.' },
  { icon: Dumbbell, title: 'Treino guiado', text: 'Periodização com registro de carga.' },
  { icon: ShieldCheck, title: 'Revisão humana', text: 'Todo ajuste passa pelo seu médico.' },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // Login sem banco não faria nada: manda para o passo a passo.
  if (!isSupabaseConfigured()) redirect('/configurar');

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
          © 2026 Ryse · Dados protegidos pela LGPD
        </p>
      </section>

      {/* -------------------------------------------- formulário */}
      <section className="flex min-h-dvh flex-col px-6 py-6 pt-safe sm:px-10 lg:min-h-0 lg:justify-center">
        <div className="flex items-center justify-between">
          <RyseLogo className="lg:invisible" />
          <ThemeToggle />
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8 lg:py-0">
          {children}
        </div>

        <p className="pb-safe text-center text-2xs text-subtle lg:hidden">
          © 2026 Ryse · Protegido pela LGPD
        </p>
      </section>
    </main>
  );
}

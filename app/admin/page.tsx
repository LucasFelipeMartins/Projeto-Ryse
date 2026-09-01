import { AdminView } from '@/components/features/admin-view';
import { RyseLogo } from '@/components/layout/brand';
import { ThemeToggle } from '@/components/ui/interactive';
import { SignOutButton } from '@/components/layout/app-shell';
import { requireAdmin, homeFor } from '@/lib/supabase/server';
import { getResumoAdmin, listarProfissionais } from '@/lib/queries/admin';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = { title: 'Administração' };

/**
 * Área administrativa.
 *
 * Fica fora do grupo (shell) porque não pertence a nenhum dos dois papéis: o
 * admin continua sendo paciente ou profissional no restante do app, e a
 * navegação de lá não faz sentido aqui. Uma casca própria e enxuta também
 * deixa claro que se trata de outro contexto.
 *
 * `requireAdmin()` manda quem não é admin para a própria home, sem 403 — não
 * há por que anunciar que esta área existe.
 */
export default async function AdminPage() {
  const admin = await requireAdmin();

  const [profissionais, resumo] = await Promise.all([
    listarProfissionais(),
    getResumoAdmin(),
  ]);

  return (
    <main className="min-h-dvh bg-canvas">
      <header className="glass sticky top-0 z-40 pt-safe">
        <div className="mx-auto flex h-header w-full max-w-4xl items-center gap-3 px-4 sm:px-6">
          <RyseLogo />
          <span className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
            Admin
          </span>

          <div className="ml-auto flex items-center gap-1">
            <Link
              href={homeFor(admin.role)}
              className="tap flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-fg"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Voltar ao app</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <AdminView
          profissionais={profissionais}
          resumo={resumo}
          adminName={admin.fullName}
        />

        <div className="mt-8 rounded-2xl border border-line bg-surface p-4">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}

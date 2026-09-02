import { redirect } from 'next/navigation';
import { PrimeiraSenhaForm } from '@/components/features/account-forms';
import { RyseLogo } from '@/components/layout/brand';
import { ThemeToggle } from '@/components/ui/interactive';
import { getSessionUser, homeFor } from '@/lib/supabase/server';

export const metadata = { title: 'Definir senha' };

/**
 * Troca obrigatória da senha provisória.
 *
 * Fica fora do grupo (shell) e fora de (auth): exige sessão, mas não pode
 * mostrar o app. É o único destino permitido enquanto `must_change_password`
 * estiver ligado — `requirePatient`, `requireProfessional` e `requireAdmin`
 * mandam todos para cá.
 */
export default async function DefinirSenhaPage() {
  const user = await getSessionUser();

  if (!user) redirect('/entrar');

  // Sem exigência pendente, esta tela não tem razão de existir.
  if (!user.mustChangePassword) redirect(homeFor(user.role));

  return (
    <main className="min-h-dvh bg-canvas">
      <header className="mx-auto flex h-header w-full max-w-sm items-center justify-between px-6 pt-safe">
        <RyseLogo />
        <ThemeToggle />
      </header>

      <div className="mx-auto w-full max-w-sm px-6 py-8">
        <PrimeiraSenhaForm email={user.email} />
      </div>
    </main>
  );
}

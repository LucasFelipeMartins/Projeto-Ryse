import { redirect } from 'next/navigation';
import { OnboardingView } from '@/components/features/onboarding-view';
import { RyseLogo } from '@/components/layout/brand';
import { ThemeToggle } from '@/components/ui/interactive';
import { requirePatientRaw } from '@/lib/supabase/server';

export const metadata = { title: 'Vamos começar' };

/**
 * Formulário obrigatório de primeiro acesso.
 *
 * Fica fora do grupo (shell) porque o app ainda não deve aparecer: nada de
 * menu, tab bar ou atalho para o dashboard antes de o perfil existir.
 *
 * `requirePatientRaw()` — e não `requirePatient()` — porque este é justamente
 * o destino de quem não concluiu o onboarding; a variante estrita mandaria a
 * página para si mesma, em laço.
 */
export default async function OnboardingPage() {
  const user = await requirePatientRaw();

  // Já preencheu: não há por que repetir.
  if (user.onboardedAt) redirect('/inicio');

  return (
    <main className="min-h-dvh bg-canvas">
      <header className="glass sticky top-0 z-40 pt-safe">
        <div className="mx-auto flex h-header w-full max-w-lg items-center justify-between px-4">
          <RyseLogo />
          <ThemeToggle />
        </div>
      </header>

      <OnboardingView user={user} />

      <p className="pb-safe pb-8 text-center text-2xs text-subtle">
        Seus dados de saúde são protegidos pela LGPD.
      </p>
    </main>
  );
}

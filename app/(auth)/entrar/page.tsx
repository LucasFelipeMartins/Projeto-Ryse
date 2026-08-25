import { Suspense } from 'react';
import { SignInForm } from '@/components/features/auth-forms';

export const metadata = { title: 'Entrar' };

export default function EntrarPage() {
  // useSearchParams (para ?proximo=) exige um limite de Suspense.
  return (
    <Suspense fallback={<div className="h-80" />}>
      <SignInForm />
    </Suspense>
  );
}

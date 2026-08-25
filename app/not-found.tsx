import Link from 'next/link';
import { RyseLogo } from '@/components/layout/brand';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <RyseLogo size="lg" className="mb-8" />
      <p className="text-sm font-bold uppercase tracking-widest text-brand-text">Erro 404</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Página não encontrada</h1>
      <p className="mt-2 max-w-sm text-muted">
        O link que você abriu não existe ou foi movido para outro lugar.
      </p>
      <Link
        href="/inicio"
        className="tap mt-8 inline-flex h-12 items-center rounded-xl bg-brand px-6 font-semibold text-brand-on shadow-brand"
      >
        Voltar para o início
      </Link>
    </main>
  );
}

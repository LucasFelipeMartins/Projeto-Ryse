import { WifiOff } from 'lucide-react';
import { RyseLogo } from '@/components/layout/brand';

export const metadata = { title: 'Sem conexão' };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <RyseLogo size="lg" className="mb-10" />
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface-2 text-subtle">
        <WifiOff className="h-6 w-6" aria-hidden />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Você está offline</h1>
      <p className="mt-2 max-w-sm text-muted">
        Seu plano volta a aparecer assim que a conexão for restabelecida.
      </p>
    </main>
  );
}

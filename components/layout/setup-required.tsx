import { Database, ExternalLink, Terminal } from 'lucide-react';
import { RyseLogo } from '@/components/layout/brand';

const steps = [
  {
    title: 'Crie um projeto no Supabase',
    body: 'Em supabase.com/dashboard, crie um projeto e escolha a região São Paulo.',
  },
  {
    title: 'Rode as migrations',
    body: 'No SQL Editor, execute na ordem os arquivos de supabase/migrations/ e, se quiser dados de exemplo, supabase/seed.sql.',
  },
  {
    title: 'Copie as chaves',
    body: 'Em Project Settings › API, copie a Project URL e a chave anon public.',
  },
  {
    title: 'Preencha o .env.local',
    body: 'Duplique .env.example como .env.local, cole os valores e reinicie o servidor.',
  },
];

/**
 * Tela mostrada quando faltam as variáveis do Supabase.
 *
 * Existe para que a primeira execução (e o primeiro deploy na Vercel, antes de
 * definir as variáveis) mostre o que fazer em vez de um erro 500.
 */
export function SetupRequired() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <RyseLogo size="lg" className="mb-8" />

        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-on">
            <Database className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Conecte o banco de dados</h1>
            <p className="text-sm text-muted">
              O Ryse precisa de um projeto Supabase para funcionar.
            </p>
          </div>
        </div>

        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className="flex gap-3 rounded-2xl border border-line bg-surface p-4"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-bold tabular-nums text-muted">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 rounded-2xl border border-line bg-surface-2 p-4">
          <p className="mb-2 flex items-center gap-2 text-2xs font-bold uppercase tracking-wider text-subtle">
            <Terminal className="h-3.5 w-3.5" aria-hidden />
            .env.local
          </p>
          <pre className="overflow-x-auto text-2xs leading-relaxed text-muted">
            <code>{`NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
NEXT_PUBLIC_SITE_URL=http://localhost:3000`}</code>
          </pre>
        </div>

        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noreferrer"
          className="tap mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand font-semibold text-brand-on shadow-brand"
        >
          Abrir o Supabase
          <ExternalLink className="h-4 w-4" aria-hidden />
        </a>

        <p className="mt-4 text-center text-2xs text-subtle">
          Na Vercel, as mesmas variáveis vão em Settings › Environment Variables.
        </p>
      </div>
    </main>
  );
}

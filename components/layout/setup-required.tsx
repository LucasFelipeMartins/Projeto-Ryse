import { Database, ExternalLink, RefreshCw, Terminal } from 'lucide-react';
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
 * Existe para que a primeira execução (e o primeiro deploy, antes de definir
 * as variáveis) mostre o que fazer em vez de um erro 500.
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

/* ------------------------------------------------------ SCHEMA ANTIGO --- */

/**
 * Banco conectado, mas desatualizado em relação ao código.
 *
 * Este é o estado em que a aplicação subiu com uma versão nova e a migration
 * ainda não rodou: a leitura do perfil pede colunas que não existem, falha, e
 * o app não consegue montar a sessão.
 *
 * Antes isso aparecia como "perfil ausente" e derrubava a sessão de quem
 * tinha acabado de entrar — uma mensagem que apontava para o lugar errado e
 * um efeito que impedia qualquer acesso. Aqui o diagnóstico é explícito e a
 * conta continua intacta: assim que a migration rodar, basta recarregar.
 */
export function SchemaDesatualizado() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <RyseLogo size="lg" className="mb-8" />

        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warn text-white">
            <RefreshCw className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight">
              O banco está desatualizado
            </h1>
            <p className="text-sm text-muted">
              A aplicação foi atualizada, mas o banco ainda não.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-warn/30 bg-warn-soft p-4">
          <p className="text-sm leading-relaxed text-muted">
            Sua conta está correta e a sessão continua válida — o que falta é
            rodar a migration no Supabase. Enquanto isso, o app não consegue ler
            o perfil porque ele procura colunas que ainda não existem.
          </p>
        </div>

        <ol className="mt-4 space-y-3">
          {[
            {
              title: 'Abra o SQL Editor do Supabase',
              body: 'No painel do seu projeto, menu lateral › SQL Editor › New query.',
            },
            {
              title: 'Rode a migration pendente',
              body: 'Cole o conteúdo de supabase/migrations/20260101000005_plataforma.sql e execute. Ela é idempotente: rodar duas vezes não causa dano.',
            },
            {
              title: 'Recarregue esta página',
              body: 'Nada mais é necessário. A sessão atual continua valendo.',
            },
          ].map((step, i) => (
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
            Detalhe técnico
          </p>
          <p className="text-2xs leading-relaxed text-muted">
            O log do servidor traz a coluna exata que falta, no formato{' '}
            <code className="font-mono">[auth] falha ao ler o perfil: 42703 …</code>
          </p>
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
      </div>
    </main>
  );
}

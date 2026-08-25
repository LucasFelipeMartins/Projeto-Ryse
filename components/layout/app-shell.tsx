'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import {
  Bell,
  ChevronLeft,
  LogOut,
  MoreHorizontal,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  isActive,
  patientNav,
  patientTabs,
  proMoreItems,
  proNav,
  proTabs,
  type NavItem,
} from '@/lib/nav';
import { signOut } from '@/lib/actions/auth';
import type { SessionUser } from '@/lib/supabase/server';
import { Avatar } from '@/components/ui';
import { Sheet, ThemeToggle, useDismissOnRouteChange } from '@/components/ui/interactive';
import { RyseMark, RyseWordmark } from '@/components/layout/brand';

/* --------------------------------------------------------------- TÍTULOS */

const TITLES: Record<string, string> = {
  '/inicio': 'Início',
  '/nutricao': 'Nutrição',
  '/treino': 'Treino',
  '/treino/sessao': 'Sessão de treino',
  '/progresso': 'Progresso',
  '/documentos': 'Meus documentos',
  '/profissionais': 'Meu profissional',
  '/perfil': 'Perfil',
  '/checkin': 'Check-in semanal',
  '/mensagens': 'Mensagens',
  '/pro': 'Painel',
  '/pro/pacientes': 'Pacientes',
  '/pro/revisao': 'Revisão IA',
  '/pro/protocolos': 'Protocolos',
  '/pro/mensagens': 'Mensagens',
  '/pro/financeiro': 'Faturamento',
  '/pro/config': 'Configurações',
};

/** Rotas de detalhe mostram voltar em vez do título raiz. */
const isDetail = (pathname: string) => TITLES[pathname] === undefined;

function titleFor(pathname: string) {
  if (TITLES[pathname]) return TITLES[pathname];
  const parent = Object.keys(TITLES)
    .filter((k) => k !== '/' && pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return parent ? TITLES[parent] : 'Ryse';
}

/* ----------------------------------------------------------------- SHELL */

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // O papel vem da sessão, nunca da URL.
  const isPro = user.role === 'profissional';
  const nav = isPro ? proNav : patientNav;
  const tabs = isPro ? proTabs : patientTabs;

  const [moreOpen, setMoreOpen] = useState(false);
  const closeMore = useCallback(() => setMoreOpen(false), []);
  useDismissOnRouteChange(pathname, closeMore);

  return (
    <div className="min-h-dvh bg-canvas">
      <Sidebar nav={nav} user={user} pathname={pathname} />

      {/* lg:pl-64 abre espaço para a sidebar fixa do desktop */}
      <div className="lg:pl-64">
        <TopBar pathname={pathname} isPro={isPro} />

        <main
          id="conteudo"
          className={cn(
            'mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 lg:px-8',
            // espaço para a tab bar + área segura do iOS; some no desktop
            'pb-[calc(theme(spacing.tabbar)+env(safe-area-inset-bottom)+1rem)] lg:pb-12',
          )}
        >
          {children}
        </main>
      </div>

      <BottomNav tabs={tabs} pathname={pathname} isPro={isPro} onMore={() => setMoreOpen(true)} />

      {isPro && (
        <Sheet
          open={moreOpen}
          onClose={closeMore}
          title="Mais"
          description="Módulos de gestão da clínica."
        >
          <div className="divide-y divide-line pb-4">
            {proMoreItems.map((item) => (
              <Link key={item.href} href={item.href} className="tap flex items-center gap-3 py-3.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-muted">
                  <item.icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="flex-1 text-sm font-semibold">{item.label}</span>
              </Link>
            ))}
            <SignOutButton className="w-full py-3.5" />
          </div>
        </Sheet>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ SAIR */

export function SignOutButton({ className }: { className?: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => void signOut())}
      disabled={pending}
      className={cn(
        'tap flex items-center gap-3 text-left text-sm font-semibold text-danger disabled:opacity-60',
        className,
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2">
        <LogOut className="h-5 w-5" aria-hidden />
      </span>
      <span className="flex-1">{pending ? 'Saindo…' : 'Sair da conta'}</span>
    </button>
  );
}

/* --------------------------------------------------------------- TOP BAR */

function TopBar({ pathname, isPro }: { pathname: string; isPro: boolean }) {
  const router = useRouter();
  const detail = isDetail(pathname);

  return (
    <header className="glass sticky top-0 z-40 pt-safe">
      <div className="mx-auto flex h-header w-full max-w-6xl items-center gap-2 px-2 sm:px-4 lg:px-8">
        {detail ? (
          <button
            onClick={() => router.back()}
            aria-label="Voltar"
            className="tap -ml-1 flex h-10 w-10 items-center justify-center rounded-xl text-fg hover:bg-surface-2 lg:hidden"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden />
          </button>
        ) : (
          <Link href={isPro ? '/pro' : '/inicio'} className="ml-1.5 lg:hidden">
            <RyseMark className="h-8 w-8" />
            <span className="sr-only">Ryse — início</span>
          </Link>
        )}

        <h1
          className={cn(
            'min-w-0 flex-1 truncate text-base font-bold tracking-tight lg:text-lg',
            !detail && 'ml-1 lg:ml-0',
          )}
        >
          {titleFor(pathname)}
        </h1>

        {/* Busca só no desktop — no mobile ela vive dentro de cada tela */}
        <div className="relative hidden lg:block">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
            aria-hidden
          />
          <input
            type="search"
            placeholder={isPro ? 'Buscar paciente ou protocolo' : 'Buscar no meu plano'}
            aria-label="Buscar"
            className="h-10 w-72 rounded-xl border border-line bg-surface pl-9 pr-3 text-sm placeholder:text-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>

        <ThemeToggle />

        <Link
          href={isPro ? '/pro/mensagens' : '/mensagens'}
          aria-label="Notificações"
          className="tap relative flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg"
        >
          <Bell className="h-5 w-5" aria-hidden />
          <span className="absolute right-2.5 top-2 h-2 w-2 rounded-full bg-brand ring-2 ring-canvas" />
        </Link>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------- BOTTOM NAV */

function BottomNav({
  tabs,
  pathname,
  isPro,
  onMore,
}: {
  tabs: NavItem[];
  pathname: string;
  isPro: boolean;
  onMore: () => void;
}) {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-xl pb-safe lg:hidden"
    >
      <ul className="flex h-tabbar items-stretch">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className="tap relative flex h-full flex-col items-center justify-center gap-1 px-1"
              >
                <span className="relative">
                  <tab.icon
                    className={cn(
                      'h-[22px] w-[22px] transition-colors',
                      active ? 'text-brand' : 'text-subtle',
                    )}
                    strokeWidth={active ? 2.4 : 1.9}
                    aria-hidden
                  />
                </span>
                <span
                  className={cn(
                    'text-[10px] font-semibold leading-none tracking-tight',
                    active ? 'text-brand-text' : 'text-subtle',
                  )}
                >
                  {tab.short ?? tab.label}
                </span>
              </Link>
            </li>
          );
        })}

        {isPro && (
          <li className="flex-1">
            <button
              onClick={onMore}
              className="tap flex h-full w-full flex-col items-center justify-center gap-1"
            >
              <MoreHorizontal className="h-[22px] w-[22px] text-subtle" aria-hidden />
              <span className="text-[10px] font-semibold leading-none tracking-tight text-subtle">
                Mais
              </span>
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}

/* --------------------------------------------------------------- SIDEBAR */

function Sidebar({
  nav,
  user,
  pathname,
}: {
  nav: { group: string; items: NavItem[] }[];
  user: SessionUser;
  pathname: string;
}) {
  const isPro = user.role === 'profissional';

  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
      <div className="flex h-header items-center gap-2.5 border-b border-line px-5">
        <RyseMark className="h-8 w-8" />
        <RyseWordmark className="text-base text-fg" />
        <span className="ml-auto rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
          {isPro ? 'Pro' : 'App'}
        </span>
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
        {nav.map((group) => (
          <div key={group.group} className="mb-5 last:mb-0">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-subtle">
              {group.group}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                        active
                          ? 'bg-brand-soft font-semibold text-brand-text'
                          : 'text-muted hover:bg-surface-2 hover:text-fg',
                      )}
                    >
                      {active && (
                        <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand" />
                      )}
                      <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                      <span className="flex-1 truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-3">
        <Link
          href={isPro ? '/pro/config' : '/perfil'}
          className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2"
        >
          <Avatar name={user.fullName} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.fullName}</p>
            <p className="truncate text-xs text-muted">
              {isPro ? (user.specialty ?? 'Profissional') : (user.goal ?? user.email)}
            </p>
          </div>
        </Link>

        <SignOutButton className="mt-1 px-2 py-1.5 text-xs" />
      </div>
    </aside>
  );
}

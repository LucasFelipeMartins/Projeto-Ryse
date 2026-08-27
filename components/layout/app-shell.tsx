'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  MoreHorizontal,
  Search,
  Settings,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  isActive,
  patientNav,
  patientTabs,
  proMoreItems,
  proNav,
  proTabs,
  settingsHrefFor,
  type NavGroup,
  type NavItem,
} from '@/lib/nav';
import { signOut } from '@/lib/actions/auth';
import type { SessionUser } from '@/lib/supabase/server';
import { Avatar } from '@/components/ui';
import {
  Drawer,
  Sheet,
  ThemeToggle,
  useDismissOnRouteChange,
} from '@/components/ui/interactive';
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
  '/notificacoes': 'Notificações',
  '/pro': 'Painel',
  '/pro/pacientes': 'Pacientes',
  '/pro/revisao': 'Revisão IA',
  '/pro/protocolos': 'Protocolos',
  '/pro/mensagens': 'Mensagens',
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

const roleLabel = (user: SessionUser) =>
  user.role === 'profissional'
    ? (user.specialty ?? 'Profissional')
    : (user.goal ?? user.email);

/* ----------------------------------------------------------------- SHELL */

export function AppShell({
  user,
  unreadCount = 0,
  children,
}: {
  user: SessionUser;
  unreadCount?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // O papel vem da sessão, nunca da URL.
  const isPro = user.role === 'profissional';
  const nav = isPro ? proNav : patientNav;
  const tabs = isPro ? proTabs : patientTabs;

  const [moreOpen, setMoreOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMore = useCallback(() => setMoreOpen(false), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // Navegar fecha os dois — deixar um menu aberto sobre a tela nova é um
  // clássico de app mobile mal resolvido.
  useDismissOnRouteChange(pathname, closeMore);
  useDismissOnRouteChange(pathname, closeMenu);

  return (
    <div className="min-h-dvh bg-canvas">
      <Sidebar nav={nav} user={user} pathname={pathname} />

      {/* lg:pl-64 abre espaço para a sidebar fixa do desktop */}
      <div className="lg:pl-64">
        <TopBar
          pathname={pathname}
          isPro={isPro}
          user={user}
          unreadCount={unreadCount}
          onMenu={() => setMenuOpen(true)}
        />

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

      <BottomNav
        tabs={tabs}
        pathname={pathname}
        user={user}
        onMenu={() => setMenuOpen(true)}
      />

      <MobileMenu
        open={menuOpen}
        onClose={closeMenu}
        user={user}
        nav={nav}
        pathname={pathname}
        unreadCount={unreadCount}
      />

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

/* ------------------------------------------------------------- MENU MOBILE */

/**
 * Menu principal do celular.
 *
 * Guarda o que não cabe na tab bar: avatar, nome, as seções do papel,
 * notificações, configurações e sair. A tab bar fica com as quatro telas de
 * uso diário — o resto mora aqui, a um toque.
 *
 * Os grupos vêm de `lib/nav.ts`, os mesmos do desktop, e são escolhidos pelo
 * papel da sessão: um paciente nunca recebe a lista do profissional, nem por
 * engano de rota.
 */
function MobileMenu({
  open,
  onClose,
  user,
  nav,
  pathname,
  unreadCount,
}: {
  open: boolean;
  onClose: () => void;
  user: SessionUser;
  nav: NavGroup[];
  pathname: string;
  unreadCount: number;
}) {
  const isPro = user.role === 'profissional';

  return (
    <Drawer open={open} onClose={onClose} label="Menu principal">
      {/* ------------------------------------------------ identidade */}
      <div className="flex items-start gap-3 border-b border-line px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <Link href={settingsHrefFor(isPro)} onClick={onClose} className="shrink-0">
          <Avatar name={user.fullName} src={user.avatarUrl} size="lg" />
        </Link>

        <div className="min-w-0 flex-1 pt-1">
          <p className="truncate text-base font-bold tracking-tight">{user.fullName}</p>
          <p className="truncate text-sm text-muted">{roleLabel(user)}</p>
          <span className="mt-1.5 inline-block rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-wider text-muted">
            {isPro ? 'Profissional' : 'Cliente'}
          </span>
        </div>

        <button
          onClick={onClose}
          aria-label="Fechar menu"
          className="tap -mr-1 -mt-1 rounded-xl p-2 text-muted hover:bg-surface-2 hover:text-fg"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {/* ------------------------------------------------ navegação */}
      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-3">
        {nav.map((group) => (
          <div key={group.group} className="mb-4 last:mb-0">
            <p className="px-3 pb-1.5 text-2xs font-bold uppercase tracking-wider text-subtle">
              {group.group}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item);
                const badge = item.href === '/notificacoes' ? unreadCount : 0;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors',
                        active
                          ? 'bg-brand-soft font-semibold text-brand-text'
                          : 'text-muted active:bg-surface-2',
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" aria-hidden />
                      <span className="flex-1 truncate">{item.label}</span>

                      {badge > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-2xs font-bold text-brand-on">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}

                      <ChevronRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* ------------------------------------------------ rodapé */}
      <div className="border-t border-line px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
        <Link
          href={settingsHrefFor(isPro)}
          onClick={onClose}
          className="tap flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-muted active:bg-surface-2"
        >
          <Settings className="h-5 w-5 shrink-0" aria-hidden />
          <span className="flex-1">Configurações</span>
        </Link>

        <div className="flex items-center gap-3 rounded-xl px-3 py-2">
          <span className="flex-1 text-sm font-semibold text-muted">Tema</span>
          <ThemeToggle className="h-9 w-9" />
        </div>

        <SignOutButton className="w-full rounded-xl px-3 py-3" />
      </div>
    </Drawer>
  );
}

/* --------------------------------------------------------------- TOP BAR */

function TopBar({
  pathname,
  isPro,
  user,
  unreadCount,
  onMenu,
}: {
  pathname: string;
  isPro: boolean;
  user: SessionUser;
  unreadCount: number;
  onMenu: () => void;
}) {
  const router = useRouter();
  const detail = isDetail(pathname);

  return (
    <header className="glass sticky top-0 z-40 pt-safe">
      <div className="mx-auto flex h-header w-full max-w-6xl items-center gap-1 px-2 sm:px-4 lg:px-8">
        {detail ? (
          <button
            onClick={() => router.back()}
            aria-label="Voltar"
            className="tap -ml-1 flex h-10 w-10 items-center justify-center rounded-xl text-fg hover:bg-surface-2 lg:hidden"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden />
          </button>
        ) : (
          <button
            onClick={onMenu}
            aria-label="Abrir menu"
            className="tap -ml-1 flex h-10 w-10 items-center justify-center rounded-xl text-fg hover:bg-surface-2 lg:hidden"
          >
            <Menu className="h-6 w-6" aria-hidden />
          </button>
        )}

        <h1
          className={cn(
            'min-w-0 flex-1 truncate text-base font-bold tracking-tight lg:text-lg',
            'ml-1 lg:ml-0',
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

        <ThemeToggle className="hidden lg:inline-flex" />

        <Link
          href={isPro ? '/pro/mensagens' : '/notificacoes'}
          aria-label={
            unreadCount > 0
              ? `Notificações — ${unreadCount} não lidas`
              : 'Notificações'
          }
          className="tap relative flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg"
        >
          <Bell className="h-5 w-5" aria-hidden />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-brand-on ring-2 ring-canvas">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>

        {/* O avatar no cabeçalho é o atalho de identidade no desktop. */}
        <Link
          href={settingsHrefFor(isPro)}
          aria-label="Meu perfil"
          className="ml-0.5 hidden rounded-full lg:block"
        >
          <Avatar name={user.fullName} src={user.avatarUrl} size="sm" />
        </Link>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------- BOTTOM NAV */

function BottomNav({
  tabs,
  pathname,
  user,
  onMenu,
}: {
  tabs: NavItem[];
  pathname: string;
  user: SessionUser;
  onMenu: () => void;
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

        {/*
          A quinta posição é o menu, e o gatilho é o próprio avatar: identidade
          e navegação secundária no mesmo toque, sem gastar mais uma aba.
        */}
        <li className="flex-1">
          <button
            onClick={onMenu}
            aria-label="Abrir menu"
            className="tap flex h-full w-full flex-col items-center justify-center gap-1"
          >
            <Avatar name={user.fullName} src={user.avatarUrl} size="xs" />
            <span className="text-[10px] font-semibold leading-none tracking-tight text-subtle">
              Menu
            </span>
          </button>
        </li>
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
  nav: NavGroup[];
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
          href={settingsHrefFor(isPro)}
          className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2"
        >
          <Avatar name={user.fullName} src={user.avatarUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.fullName}</p>
            <p className="truncate text-xs text-muted">{roleLabel(user)}</p>
          </div>
        </Link>

        <SignOutButton className="mt-1 px-2 py-1.5 text-xs" />
      </div>
    </aside>
  );
}

/** Reexportado para telas que precisam do mesmo botão fora do shell. */
export { MoreHorizontal };

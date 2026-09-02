'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Monitor, Moon, Sun, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme, type Theme } from '@/lib/theme';

/* ------------------------------------------------------------ BOTTOM SHEET */

/**
 * Folha inferior — o padrão de modal nativo em Android/iOS.
 * No desktop (`sm:`) vira um diálogo centralizado.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const titleId = useId();

  useEffect(() => setMounted(true), []);

  // Fecha no ESC e trava o scroll do fundo enquanto a folha está aberta.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 animate-backdrop-in bg-black/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'relative flex max-h-[88vh] w-full flex-col overflow-hidden bg-surface',
          'animate-sheet-up rounded-t-3xl border border-line shadow-pop',
          'sm:max-w-lg sm:animate-scale-in sm:rounded-3xl',
        )}
      >
        {/* alça de arrasto — afordância de folha no mobile */}
        <div className="flex justify-center pt-3 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-line-strong" aria-hidden />
        </div>

        <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold tracking-tight">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="tap -mr-1 -mt-1 rounded-xl p-2 text-muted hover:bg-surface-2 hover:text-fg"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 pb-2">{children}</div>

        {footer && (
          <div className="border-t border-line bg-surface px-5 py-4 pb-safe">{footer}</div>
        )}
        {!footer && <div className="pb-safe" />}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------- DRAWER --- */

/**
 * Gaveta lateral — o menu principal do mobile.
 *
 * Difere do `Sheet` de propósito: a folha inferior serve para uma ação
 * pontual, a gaveta serve para navegar. Ela desliza da esquerda, ocupa no
 * máximo 20rem (nunca a tela inteira, para o conteúdo continuar visível
 * atrás) e fecha ao tocar no fundo, no ESC ou ao trocar de rota.
 *
 * O foco vai para dentro da gaveta ao abrir, e o scroll do fundo trava —
 * sem isso, rolar o menu arrasta a página junto no iOS.
 */
export function Drawer({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const painel = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const prev = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    painel.current?.focus();

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] lg:hidden">
      <div
        className="absolute inset-0 animate-backdrop-in bg-black/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cn(
          'relative flex h-full w-[86%] max-w-[20rem] flex-col bg-surface shadow-pop outline-none',
          'animate-drawer-in border-r border-line',
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------- SEGMENTED CONTROL */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex w-full gap-1 rounded-xl border border-line bg-surface-2 p-1',
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'tap flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
              active
                ? 'bg-surface text-fg shadow-card'
                : 'text-muted hover:text-fg',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- CHIP ROW */

/** Fila de filtros com rolagem horizontal — evita `select` nativo no mobile. */
export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('snap-x-chips -mx-4 px-4 py-0.5 sm:mx-0 sm:px-0', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn(
              'tap snap-start whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors',
              active
                ? 'border-brand bg-brand text-brand-on'
                : 'border-line bg-surface text-muted hover:border-line-strong hover:text-fg',
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cn('ml-1.5 tabular-nums', active ? 'opacity-70' : 'text-subtle')}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ TABS */

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="no-scrollbar -mx-4 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      <div role="tablist" className="flex min-w-max gap-1">
        {tabs.map((t) => {
          const active = t.value === value;
          return (
            <button
              key={t.value}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(t.value)}
              className={cn(
                'relative px-3 py-3 text-sm font-semibold transition-colors',
                active ? 'text-fg' : 'text-muted hover:text-fg',
              )}
            >
              {t.label}
              {active && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- INPUTS */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-sm text-muted">{hint}</span>}
    </label>
  );
}

const inputBase =
  'w-full rounded-xl border border-line bg-surface px-3.5 text-fg placeholder:text-subtle ' +
  'transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 focus:ring-offset-0';

export function Input({
  className,
  icon: Icon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon?: LucideIcon }) {
  if (Icon) {
    return (
      <div className="relative">
        <Icon
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
          aria-hidden
        />
        <input className={cn(inputBase, 'h-11 pl-10 text-sm', className)} {...props} />
      </div>
    );
  }
  return <input className={cn(inputBase, 'h-11 text-sm', className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputBase, 'py-3 text-sm', className)} {...props} />;
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputBase, 'h-11 pr-9 text-sm', className)} {...props}>
      {children}
    </select>
  );
}

/* ----------------------------------------------------------------- SWITCH */

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-7 w-12 shrink-0 rounded-full transition-colors',
        checked ? 'bg-brand' : 'bg-surface-3',
      )}
    >
      <span
        className={cn(
          'absolute top-1 h-5 w-5 rounded-full bg-white shadow-card transition-transform duration-200 ease-spring',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  );
}

/* ----------------------------------------------------------- THEME TOGGLE */

/** Botão rápido de tema — alterna claro/escuro em um toque. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, toggle } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <button
      onClick={toggle}
      aria-label={resolved === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
      title={resolved === 'dark' ? 'Modo claro' : 'Modo escuro'}
      className={cn(
        'tap inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted',
        'transition-colors hover:bg-surface-2 hover:text-fg',
        className,
      )}
    >
      {/* Antes de hidratar não sabemos o tema: mantém o ícone estável e neutro. */}
      {!mounted ? (
        <Sun className="h-5 w-5 opacity-0" aria-hidden />
      ) : resolved === 'dark' ? (
        <Sun className="h-5 w-5" aria-hidden />
      ) : (
        <Moon className="h-5 w-5" aria-hidden />
      )}
    </button>
  );
}

/** Seletor completo com a opção "Sistema" — usado na tela de perfil. */
export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const options: { value: Theme; label: string; icon: LucideIcon }[] = [
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Escuro', icon: Moon },
    { value: 'system', label: 'Sistema', icon: Monitor },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((o) => {
        const active = mounted && theme === o.value;
        return (
          <button
            key={o.value}
            onClick={() => setTheme(o.value)}
            aria-pressed={active}
            className={cn(
              'tap flex flex-col items-center gap-2 rounded-xl border px-3 py-3.5 transition-colors',
              active
                ? 'border-brand bg-brand-soft text-brand-text'
                : 'border-line bg-surface text-muted hover:border-line-strong hover:text-fg',
            )}
          >
            <o.icon className="h-5 w-5" aria-hidden />
            <span className="text-sm font-semibold">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- CHECKBOX */

export function CheckCircle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'tap flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
        checked
          ? 'border-brand bg-brand text-brand-on'
          : 'border-line-strong bg-transparent text-transparent hover:border-brand',
      )}
    >
      <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
    </button>
  );
}

/* ------------------------------------------------------------ COPY TO USE */

/** Fecha automaticamente ao trocar de rota — usado pelos menus do shell. */
export function useDismissOnRouteChange(pathname: string, close: () => void) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    close();
  }, [pathname, close]);
}

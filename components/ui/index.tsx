import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tone } from '@/lib/types';

// Reexportado para que todo o app continue importando de '@/components/ui'.
export { Avatar, type AvatarSize } from '@/components/ui/avatar';

/* ------------------------------------------------------------------- CARD */

export function Card({
  className,
  children,
  inset = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-line bg-surface shadow-card',
        !inset && 'p-4 sm:p-5',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  hint,
  action,
  className,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-3 flex items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ BADGE */

const toneStyles: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted border-line',
  brand: 'bg-brand-soft text-brand-text border-brand-line',
  success: 'bg-success-soft text-success border-success/25',
  danger: 'bg-danger-soft text-danger border-danger/25',
  warn: 'bg-warn-soft text-warn border-warn/25',
};

export function Badge({
  children,
  tone = 'neutral',
  icon: Icon,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-semibold',
        toneStyles[tone],
        className,
      )}
    >
      {Icon && <Icon className="h-3 w-3" aria-hidden />}
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- BUTTON */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'ink' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const buttonVariants: Record<ButtonVariant, string> = {
  // Laranja + texto quase preto: 6.9:1 de contraste nos dois temas.
  primary: 'bg-brand text-brand-on hover:bg-brand-hover shadow-brand',
  secondary: 'bg-surface text-fg border border-line hover:bg-surface-2 hover:border-line-strong',
  ghost: 'bg-transparent text-muted hover:bg-surface-2 hover:text-fg',
  ink: 'bg-ink text-ink-on hover:opacity-90',
  danger: 'bg-danger text-white hover:opacity-90',
};

const buttonSizes: Record<ButtonSize, string> = {
  // min-h respeita o alvo de toque de 44px recomendado no iOS/Android.
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-base gap-2 rounded-xl',
};

type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  block?: boolean;
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  block,
  className,
  children,
  ...props
}: ButtonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'tap inline-flex items-center justify-center font-semibold transition-colors',
        'disabled:pointer-events-none disabled:opacity-45',
        buttonSizes[size],
        buttonVariants[variant],
        block && 'w-full',
        className,
      )}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
      {children}
      {IconRight && <IconRight className="h-4 w-4 shrink-0" aria-hidden />}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  block,
  className,
  children,
}: ButtonProps & { href: string; className?: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        'tap inline-flex items-center justify-center font-semibold transition-colors',
        buttonSizes[size],
        buttonVariants[variant],
        block && 'w-full',
        className,
      )}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
      {children}
      {IconRight && <IconRight className="h-4 w-4 shrink-0" aria-hidden />}
    </Link>
  );
}

export function IconButton({
  icon: Icon,
  label,
  className,
  ...props
}: { icon: LucideIcon; label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        'tap inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted',
        'transition-colors hover:bg-surface-2 hover:text-fg',
        className,
      )}
      {...props}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </button>
  );
}

/* --------------------------------------------------------------- PROGRESS */

export function Progress({
  value,
  tone = 'brand',
  className,
  label,
}: {
  value: number;
  tone?: 'brand' | 'ink' | 'success' | 'cat1' | 'cat2' | 'cat3';
  className?: string;
  label?: string;
}) {
  const fills = {
    brand: 'bg-brand',
    ink: 'bg-ink',
    success: 'bg-success',
    cat1: 'bg-cat-1',
    cat2: 'bg-cat-2',
    cat3: 'bg-cat-3',
  };
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)}
    >
      {/* extremidade arredondada de 4px ancorada na base da trilha */}
      <div
        className={cn('h-full rounded-full transition-[width] duration-500 ease-spring', fills[tone])}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------- ROWS */

export function ListRow({
  href,
  onClick,
  leading,
  title,
  subtitle,
  trailing,
  className,
}: {
  href?: string;
  onClick?: () => void;
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}) {
  const body = (
    <>
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-sm text-muted">{subtitle}</div>}
      </div>
      {trailing ?? <ChevronRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden />}
    </>
  );

  const classes = cn(
    'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
    'hover:bg-surface-2 active:bg-surface-3',
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classes}>
      {body}
    </button>
  );
}

/* ------------------------------------------------------------ EMPTY STATE */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface-2 text-subtle">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-xs text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ STATS */

export function Stat({
  label,
  value,
  delta,
  up,
  hint,
  icon: Icon,
  alert,
  className,
}: {
  label: string;
  value: string;
  delta?: string;
  up?: boolean;
  hint?: string;
  icon?: LucideIcon;
  alert?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn('relative overflow-hidden', className)}>
      {alert && <span className="absolute inset-x-0 top-0 h-0.5 bg-brand" aria-hidden />}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted">{label}</p>
        {Icon && (
          <span className="rounded-lg bg-surface-2 p-1.5 text-subtle">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums sm:text-[28px]">
        {value}
      </p>
      {delta && (
        <p
          className={cn(
            'mt-1.5 text-sm font-semibold',
            alert ? 'text-brand-text' : up ? 'text-success' : 'text-danger',
          )}
        >
          {delta}
          {hint && <span className="ml-1 font-normal text-subtle">{hint}</span>}
        </p>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------- PAGE INTRO */

/**
 * Título grande no corpo da página — padrão de "large title" do iOS.
 * No desktop encolhe, porque a barra superior já mostra o nome da tela.
 */
export function PageIntro({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-5 flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1.5 text-sm font-semibold text-brand-text">{eyebrow}</div>
        )}
        <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-prose text-sm text-muted sm:text-base">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Faixa de destaque com o parecer da IA — usada nas duas visões. */
export function AiPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-line-strong bg-ink p-5 text-ink-on sm:p-6',
        className,
      )}
    >
      <span
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/25 blur-3xl"
        aria-hidden
      />
      <div className="relative">{children}</div>
    </div>
  );
}

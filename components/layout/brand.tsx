import { cn } from '@/lib/utils';

/**
 * Marca do Ryse: quadrado laranja com barras ascendentes.
 * O laranja é a constante da identidade — o símbolo fica idêntico nos dois
 * temas, e só o texto ao redor troca de cor.
 */
export function RyseMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn('shrink-0', className)}
      role="img"
      aria-label="Ryse"
    >
      <rect width="32" height="32" rx="8.5" fill="hsl(var(--brand))" />
      <g fill="hsl(var(--brand-on))">
        <rect x="8" y="19" width="3.6" height="5.6" rx="1.8" opacity="0.55" />
        <rect x="14.2" y="14.6" width="3.6" height="10" rx="1.8" opacity="0.8" />
        <rect x="20.4" y="9.4" width="3.6" height="15.2" rx="1.8" />
      </g>
    </svg>
  );
}

export function RyseWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'select-none font-bold uppercase leading-none tracking-[0.18em]',
        className,
      )}
    >
      Ryse
    </span>
  );
}

export function RyseLogo({
  className,
  size = 'md',
}: {
  className?: string;
  size?: 'md' | 'lg';
}) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <RyseMark className={size === 'lg' ? 'h-11 w-11' : 'h-8 w-8'} />
      <RyseWordmark className={size === 'lg' ? 'text-2xl' : 'text-base'} />
    </div>
  );
}

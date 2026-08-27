'use client';

import { useEffect, useState } from 'react';
import { cn, initials } from '@/lib/utils';

/**
 * Avatar do usuário.
 *
 * Cliente por um motivo só: `onError`. Uma URL de imagem pode morrer — o
 * arquivo foi apagado do bucket, a rede caiu, o link expirou — e o navegador
 * mostraria o ícone de imagem quebrada no meio do menu. Aqui a falha derruba
 * a imagem e as iniciais voltam a aparecer, sem buraco na interface.
 */

const SIZES = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
  '2xl': 'h-28 w-28 text-3xl',
} as const;

export type AvatarSize = keyof typeof SIZES;

export function Avatar({
  name,
  src,
  size = 'md',
  online,
  className,
  ring,
}: {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  online?: boolean;
  className?: string;
  /** Anel da marca — usado onde o avatar é o elemento principal da tela. */
  ring?: boolean;
}) {
  const [broken, setBroken] = useState(false);

  // Trocar de foto reaproveita o mesmo componente: sem isso, um erro antigo
  // manteria as iniciais para sempre.
  useEffect(() => setBroken(false), [src]);

  const showImage = Boolean(src) && !broken;

  return (
    <div className={cn('relative shrink-0', className)}>
      <div
        className={cn(
          'flex items-center justify-center overflow-hidden rounded-full border border-line',
          'bg-surface-2 font-bold uppercase tracking-wide text-muted',
          ring && 'ring-2 ring-brand ring-offset-2 ring-offset-canvas',
          SIZES[size],
        )}
      >
        {showImage ? (
          /*
            <img> em vez de next/image: a origem é o Storage do Supabase, que
            já entrega otimizado, e o avatar aparece em toda página — passar
            pelo otimizador do Next só somaria latência.
          */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src ?? ''}
            alt={`Foto de ${name}`}
            className="h-full w-full object-cover"
            onError={() => setBroken(true)}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span aria-hidden>{initials(name)}</span>
        )}
      </div>

      {online && (
        <span
          className="absolute -bottom-0 -right-0 block h-3 w-3 rounded-full border-2 border-surface bg-success"
          aria-label="online"
        />
      )}
    </div>
  );
}

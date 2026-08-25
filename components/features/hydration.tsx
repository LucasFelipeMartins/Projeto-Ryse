'use client';

import { useState } from 'react';
import { Droplet, Minus, Plus } from 'lucide-react';
import { Card, Progress } from '@/components/ui';
import { dailyRings } from '@/lib/data';

const STEP = 0.25; // um copo de 250 ml

/** Controle de hidratação com alvos de toque grandes o bastante para o polegar. */
export function HydrationCard() {
  const [litros, setLitros] = useState(dailyRings.water.current);
  const meta = dailyRings.water.target;
  const pct = Math.min(100, (litros / meta) * 100);

  const fmt = (n: number) => n.toFixed(2).replace('.', ',');

  return (
    <Card>
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
          <Droplet className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Hidratação</h3>
          <p className="text-sm text-muted">
            <span className="font-bold tabular-nums text-fg">{fmt(litros)} L</span> de{' '}
            {fmt(meta)} L
          </p>
        </div>
      </div>

      <Progress
        value={pct}
        className="mt-4"
        label={`Hidratação: ${Math.round(pct)}% da meta`}
      />

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={() => setLitros((v) => Math.max(0, +(v - STEP).toFixed(2)))}
          disabled={litros <= 0}
          aria-label="Remover um copo de 250 ml"
          className="tap flex h-11 w-11 items-center justify-center rounded-xl border border-line text-muted transition-colors hover:text-fg disabled:opacity-40"
        >
          <Minus className="h-5 w-5" aria-hidden />
        </button>

        {/* copos como marcadores discretos do progresso */}
        <div className="flex flex-1 items-center justify-center gap-1" aria-hidden>
          {Array.from({ length: Math.round(meta / STEP) }).map((_, i) => (
            <span
              key={i}
              className={
                'h-6 w-1.5 rounded-full transition-colors ' +
                (i < Math.round(litros / STEP) ? 'bg-brand' : 'bg-surface-3')
              }
            />
          ))}
        </div>

        <button
          onClick={() => setLitros((v) => +(v + STEP).toFixed(2))}
          aria-label="Adicionar um copo de 250 ml"
          className="tap flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-brand-on shadow-brand"
        >
          <Plus className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </Card>
  );
}

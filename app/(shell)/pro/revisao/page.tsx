import Link from 'next/link';
import { BrainCircuit, ChevronRight, Clock, ShieldCheck } from 'lucide-react';
import { Avatar, Badge, Card, PageIntro, Progress, SectionTitle } from '@/components/ui';
import { reviewQueue } from '@/lib/data';

export const metadata = { title: 'Revisão IA' };

export default function RevisaoPage() {
  return (
    <div className="space-y-5">
      <PageIntro
        eyebrow="14 casos pendentes"
        title="Revisão IA"
        description="Propostas geradas pela inteligência que aguardam sua chancela clínica."
      />

      <Card className="flex items-start gap-3 border-brand-line bg-brand-soft">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-text" aria-hidden />
        <p className="text-sm text-muted">
          Nenhuma proposta chega ao paciente sem aprovação humana. Rejeições alimentam o
          modelo e reduzem sugestões parecidas no futuro.
        </p>
      </Card>

      <SectionTitle title="Fila de decisão" hint="Ordenada por urgência e tempo de espera." />

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {reviewQueue.map((c) => (
          <Link key={c.id} href={`/pro/revisao/${c.id}`} className="tap block">
            <Card className="flex h-full flex-col transition-colors hover:border-line-strong">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={c.patient} size="sm" />
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold">{c.patient}</h3>
                    <p className="flex items-center gap-1 text-2xs font-medium text-subtle">
                      <Clock className="h-3 w-3" aria-hidden />
                      {c.age}
                    </p>
                  </div>
                </div>
                <Badge tone={c.urgency === 'alta' ? 'danger' : 'warn'}>
                  {c.urgency === 'alta' ? 'Prioridade' : 'Revisão'}
                </Badge>
              </div>

              <div className="mt-4 flex-1">
                <p className="text-sm font-semibold leading-snug">{c.summary}</p>
                <p className="mt-2 rounded-xl bg-surface-2 p-3 text-sm text-muted">
                  <strong className="font-semibold text-fg">Gatilho:</strong> {c.trigger}
                </p>
              </div>

              <div className="mt-4 border-t border-line pt-3.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-2xs font-semibold text-muted">
                    {c.module}
                  </span>
                  <span className="flex items-center gap-1 text-2xs font-bold text-brand-text">
                    <BrainCircuit className="h-3 w-3" aria-hidden />
                    {c.confidence}% de confiança
                  </span>
                </div>
                <Progress
                  value={c.confidence}
                  label={`Confiança da IA: ${c.confidence}%`}
                />
                <span className="mt-3 flex items-center gap-1 text-sm font-semibold text-brand-text">
                  Analisar proposta
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

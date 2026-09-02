'use client';

import { useState, useTransition } from 'react';
import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { Button, Card, SectionTitle } from '@/components/ui';
import { alterarSenha } from '@/lib/actions/account';
import { cn } from '@/lib/utils';

/**
 * Alteração voluntária de senha.
 *
 * Serve paciente e profissional — o formulário é o mesmo, e duplicá-lo em
 * duas telas só criaria duas oportunidades de divergir.
 *
 * Pede a senha atual. Não é burocracia: `updateUser` do Supabase aceita a
 * troca só com o cookie válido, o que transformaria uma sessão esquecida num
 * navegador emprestado em sequestro de conta. Um campo a mais fecha isso.
 */

const CLASSES = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/];

function forca(senha: string) {
  const variedade = CLASSES.filter((re) => re.test(senha)).length;

  const pontos =
    (senha.length >= 8 ? 1 : 0) +
    (senha.length >= 12 ? 1 : 0) +
    (variedade >= 2 ? 1 : 0) +
    (variedade >= 3 ? 1 : 0);

  const niveis = [
    { label: 'Muito fraca', cor: 'bg-danger', texto: 'text-danger' },
    { label: 'Fraca', cor: 'bg-danger', texto: 'text-danger' },
    { label: 'Razoável', cor: 'bg-warn', texto: 'text-warn' },
    { label: 'Boa', cor: 'bg-success', texto: 'text-success' },
    { label: 'Forte', cor: 'bg-success', texto: 'text-success' },
  ];

  return { pontos, ...niveis[pontos] };
}

function CampoSenha({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visivel ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder="••••••••"
          className="h-11 w-full rounded-xl border border-line bg-surface pl-3.5 pr-12 text-sm placeholder:text-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          className="tap absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-subtle hover:text-fg"
        >
          {visivel ? (
            <EyeOff className="h-4 w-4" aria-hidden />
          ) : (
            <Eye className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}

export function SegurancaCard() {
  const [aberto, setAberto] = useState(false);
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pending, startTransition] = useTransition();

  const limpar = () => {
    setAtual('');
    setNova('');
    setConfirmacao('');
    setError(null);
  };

  const salvar = () => {
    setError(null);
    setSalvo(false);

    if (!atual) {
      setError('Informe sua senha atual.');
      return;
    }
    if (nova !== confirmacao) {
      setError('A confirmação não confere com a nova senha.');
      return;
    }

    startTransition(async () => {
      const result = await alterarSenha({ senhaAtual: atual, novaSenha: nova });

      if (!result.ok) {
        setError(result.error ?? 'Não foi possível alterar a senha.');
        return;
      }

      limpar();
      setAberto(false);
      setSalvo(true);
    });
  };

  const nivel = forca(nova);

  return (
    <section>
      <SectionTitle title="Segurança" hint="Sua senha de acesso." />

      <Card>
        {!aberto ? (
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
              <KeyRound className="h-5 w-5" aria-hidden />
            </span>

            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">Senha</h3>
              <p className="mt-1 text-sm text-muted">
                Troque quando quiser. Pedimos a senha atual para confirmar que é
                você.
              </p>

              {salvo && (
                <p
                  role="status"
                  className="mt-3 flex items-center gap-1.5 text-sm font-medium text-success"
                >
                  <Check className="h-4 w-4 shrink-0" aria-hidden />
                  Senha alterada.
                </p>
              )}

              <Button
                size="sm"
                variant="secondary"
                className="mt-4"
                onClick={() => {
                  setSalvo(false);
                  setAberto(true);
                }}
              >
                Alterar senha
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
                <KeyRound className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <h3 className="text-sm font-semibold">Alterar senha</h3>
            </div>

            <CampoSenha
              id="senha-atual"
              label="Senha atual"
              value={atual}
              onChange={setAtual}
              autoComplete="current-password"
            />

            <div>
              <CampoSenha
                id="senha-nova"
                label="Nova senha"
                value={nova}
                onChange={setNova}
                autoComplete="new-password"
              />

              {nova && (
                <div className="mt-2">
                  <div className="flex gap-1" aria-hidden>
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={cn(
                          'h-1 flex-1 rounded-full transition-colors',
                          i < nivel.pontos ? nivel.cor : 'bg-surface-3',
                        )}
                      />
                    ))}
                  </div>
                  <p className={cn('mt-1.5 text-sm font-medium', nivel.texto)}>
                    Força: {nivel.label}
                  </p>
                </div>
              )}
            </div>

            <CampoSenha
              id="senha-confirmacao"
              label="Confirmar nova senha"
              value={confirmacao}
              onChange={setConfirmacao}
              autoComplete="new-password"
            />

            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger-soft p-3 text-sm font-medium text-danger"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {error}
              </p>
            )}

            <p className="flex items-start gap-2 rounded-xl border border-line bg-surface-2 p-3 text-sm text-muted">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-subtle" aria-hidden />
              Mínimo de 8 caracteres, misturando letras e números.
            </p>

            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <Button
                disabled={pending}
                icon={pending ? undefined : Check}
                onClick={salvar}
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Salvando…
                  </>
                ) : (
                  'Salvar nova senha'
                )}
              </Button>

              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  limpar();
                  setAberto(false);
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}

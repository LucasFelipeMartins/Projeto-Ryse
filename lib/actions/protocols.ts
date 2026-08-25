'use server';

import { revalidatePath } from 'next/cache';
import { createClient, requireProfessional } from '@/lib/supabase/server';
import type { ProtocolKind } from '@/lib/supabase/types';
import type { ActionResult } from '@/lib/types';

export type ProtocolInput = {
  title: string;
  kind: ProtocolKind;
  description: string;
  /** Uma linha por item — refeição, exercício ou exame da bateria. */
  items: string[];
  aiEnabled: boolean;
};

const KINDS: ProtocolKind[] = ['nutricao', 'treino', 'exames'];

const MAX_ITEMS = 60;
const MAX_ITEM_CHARS = 300;

function validate(input: ProtocolInput): string | null {
  if (input.title.trim().length < 3) return 'Dê um título com pelo menos 3 caracteres.';
  if (input.title.length > 140) return 'O título ficou longo demais.';
  if (!KINDS.includes(input.kind)) return 'Escolha o tipo do protocolo.';
  if (input.items.length > MAX_ITEMS) return `Use no máximo ${MAX_ITEMS} itens.`;
  if (input.items.some((i) => i.length > MAX_ITEM_CHARS)) {
    return 'Algum item ficou longo demais. Quebre em linhas menores.';
  }
  return null;
}

/** Normaliza as linhas coladas no textarea. */
const cleanItems = (items: string[]) =>
  items
    .map((i) => i.trim())
    .filter(Boolean)
    .slice(0, MAX_ITEMS);

export async function createProtocol(input: ProtocolInput): Promise<ActionResult> {
  const pro = await requireProfessional();

  const problem = validate(input);
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();

  const { error } = await supabase.from('protocols').insert({
    professional_id: pro.id,
    title: input.title.trim(),
    kind: input.kind,
    ai_enabled: input.aiEnabled,
    body: {
      description: input.description.trim(),
      items: cleanItems(input.items),
    },
  });

  if (error) return { ok: false, error: 'Não foi possível salvar o protocolo.' };

  revalidatePath('/pro/protocolos');
  return { ok: true };
}

export async function updateProtocol(
  id: string,
  input: ProtocolInput,
): Promise<ActionResult> {
  const pro = await requireProfessional();

  const problem = validate(input);
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();

  // O filtro por professional_id é redundante com a RLS, mas deixa a
  // intenção explícita e protege caso a política mude.
  const { error } = await supabase
    .from('protocols')
    .update({
      title: input.title.trim(),
      kind: input.kind,
      ai_enabled: input.aiEnabled,
      body: {
        description: input.description.trim(),
        items: cleanItems(input.items),
      },
    })
    .eq('id', id)
    .eq('professional_id', pro.id);

  if (error) return { ok: false, error: 'Não foi possível salvar as alterações.' };

  revalidatePath('/pro/protocolos');
  return { ok: true };
}

export async function deleteProtocol(id: string): Promise<ActionResult> {
  const pro = await requireProfessional();
  const supabase = await createClient();

  const { error } = await supabase
    .from('protocols')
    .delete()
    .eq('id', id)
    .eq('professional_id', pro.id);

  if (error) return { ok: false, error: 'Não foi possível apagar o protocolo.' };

  revalidatePath('/pro/protocolos');
  return { ok: true };
}

/** Liga ou desliga a permissão de a IA propor ajustes sobre este molde. */
export async function toggleProtocolAi(id: string, enabled: boolean): Promise<ActionResult> {
  const pro = await requireProfessional();
  const supabase = await createClient();

  const { error } = await supabase
    .from('protocols')
    .update({ ai_enabled: enabled })
    .eq('id', id)
    .eq('professional_id', pro.id);

  if (error) return { ok: false, error: 'Não foi possível atualizar.' };

  revalidatePath('/pro/protocolos');
  return { ok: true };
}

/** Duplica um protocolo para servir de ponto de partida. */
export async function duplicateProtocol(id: string): Promise<ActionResult> {
  const pro = await requireProfessional();
  const supabase = await createClient();

  const { data: original } = await supabase
    .from('protocols')
    .select('title, kind, ai_enabled, body')
    .eq('id', id)
    .eq('professional_id', pro.id)
    .maybeSingle();

  if (!original) return { ok: false, error: 'Protocolo não encontrado.' };

  const { error } = await supabase.from('protocols').insert({
    professional_id: pro.id,
    title: `${original.title} (cópia)`.slice(0, 140),
    kind: original.kind,
    ai_enabled: original.ai_enabled,
    body: original.body,
  });

  if (error) return { ok: false, error: 'Não foi possível duplicar.' };

  revalidatePath('/pro/protocolos');
  return { ok: true };
}

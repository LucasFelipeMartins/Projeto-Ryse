'use server';

import { revalidatePath } from 'next/cache';
import {
  createClient,
  requirePatient,
  requireProfessional,
} from '@/lib/supabase/server';
import {
  ALL_SCOPES,
  buildPatientContext,
  type ContextScope,
} from '@/lib/ai/context';
import {
  generateDiet,
  generateProtocolAnalysis,
  generateReport,
  generateWorkout,
  type ReportArea,
} from '@/lib/ai/generate';
import { completeAiRun, releaseAiRun, reserveAiRun } from '@/lib/ai/limits';
import { AiUnavailableError, isAiConfigured } from '@/lib/ai/provider';
import type { AiDiet, AiReport, AiWorkoutPlan } from '@/lib/ai/schemas';
import type { AiRequestKind, Json } from '@/lib/supabase/types';

/**
 * Ações de IA.
 *
 * Toda ação segue a mesma sequência, e a ordem importa:
 *
 *   1. autentica e resolve o papel
 *   2. reserva a cota (é aqui que o limite acontece — no banco)
 *   3. monta o contexto, já filtrado pelo protocolo do profissional
 *   4. chama o provedor
 *   5. salva o resultado e fecha a reserva
 *
 * Se qualquer passo depois do 2 falhar, a reserva é devolvida. Cobrar a cota
 * do mês por um timeout do provedor seria punir o usuário por um problema
 * que não é dele.
 */

export type AiActionResult<T> =
  | { ok: true; data: T; outputId: string; model: string; generatedAt: string }
  | { ok: false; error: string; limited?: boolean };

/** Escopo de contexto por área de relatório. */
const SCOPES_POR_AREA: Record<ReportArea, ContextScope[]> = {
  exames: ['exames', 'evolucao'],
  saude: ['saude', 'checkins', 'evolucao', 'exames'],
  treino: ['treino', 'checkins', 'evolucao'],
  nutricao: ['nutricao', 'checkins', 'evolucao'],
};

const KIND_POR_AREA: Record<ReportArea, AiRequestKind> = {
  exames: 'relatorio_exames',
  saude: 'relatorio_saude',
  treino: 'relatorio_treino',
  nutricao: 'relatorio_nutricao',
};

const TITULO_POR_AREA: Record<ReportArea, string> = {
  exames: 'Relatório de exames',
  saude: 'Relatório de saúde',
  treino: 'Relatório de treino',
  nutricao: 'Relatório de nutrição',
};

const AREAS: ReportArea[] = ['exames', 'saude', 'treino', 'nutricao'];

/**
 * Telas que exibem o relatório de cada área.
 *
 * Não há rota /saude nem /exames: saúde vive em /progresso e exames aparecem
 * nas duas telas que os mostram. Revalidar o caminho certo é o que faz o
 * resultado recém-gerado aparecer sem recarga manual.
 */
const ROTAS_POR_AREA: Record<ReportArea, string[]> = {
  exames: ['/progresso', '/documentos'],
  saude: ['/progresso'],
  treino: ['/treino'],
  nutricao: ['/nutricao'],
};

const SEM_PROVEDOR =
  'A análise por IA ainda não está ativa nesta instalação. ' +
  'Fale com o suporte para habilitar.';

/** Traduz a falha do provedor sem vazar detalhe técnico para a tela. */
function describeFailure(error: unknown): string {
  if (error instanceof AiUnavailableError) return SEM_PROVEDOR;

  const message = error instanceof Error ? error.message : String(error);

  if (/timeout|ETIMEDOUT|aborted/i.test(message)) {
    return 'A IA demorou demais para responder. Tente novamente em alguns minutos.';
  }
  if (/rate limit|429/i.test(message)) {
    return 'O serviço de IA está sobrecarregado no momento. Tente de novo em alguns minutos.';
  }
  if (/formato esperado|JSON/i.test(message)) {
    return 'A IA devolveu uma resposta inválida. Tente gerar novamente.';
  }
  return 'Não foi possível concluir a análise agora. Tente novamente.';
}

/** Salva a saída e devolve o id — o resultado fica disponível sem gastar cota de novo. */
async function persistOutput(input: {
  patientId: string;
  createdBy: string;
  kind: AiRequestKind;
  title: string;
  content: unknown;
  model: string;
}): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('ai_outputs')
    .insert({
      patient_id: input.patientId,
      created_by: input.createdBy,
      kind: input.kind,
      title: input.title,
      content: input.content as Json,
      model: input.model,
    })
    .select('id')
    .single();

  return data?.id ?? null;
}

/* ------------------------------------------------------------ RELATÓRIOS -- */

export async function gerarRelatorio(
  area: ReportArea,
): Promise<AiActionResult<AiReport>> {
  if (!AREAS.includes(area)) return { ok: false, error: 'Área inválida.' };
  if (!isAiConfigured()) return { ok: false, error: SEM_PROVEDOR };

  const user = await requirePatient();
  const kind = KIND_POR_AREA[area];

  const reservation = await reserveAiRun({
    profileId: user.id,
    patientId: user.id,
    kind,
    timezone: user.timezone,
  });

  if (!reservation.ok) {
    return { ok: false, error: reservation.error, limited: true };
  }

  try {
    const context = await buildPatientContext(user.id, {
      scopes: SCOPES_POR_AREA[area],
    });

    const { report, model } = await generateReport({
      area,
      context,
      patientLabel: user.fullName.split(' ')[0],
    });

    const outputId = await persistOutput({
      patientId: user.id,
      createdBy: user.id,
      kind,
      title: TITULO_POR_AREA[area],
      content: report,
      model,
    });

    await completeAiRun(reservation.id, outputId);

    for (const rota of ROTAS_POR_AREA[area]) revalidatePath(rota);

    return {
      ok: true,
      data: report,
      outputId: outputId ?? reservation.id,
      model,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    await releaseAiRun(reservation.id, String(error));
    return { ok: false, error: describeFailure(error) };
  }
}

/* ----------------------------------------------------------------- DIETA -- */

export async function gerarDieta(): Promise<AiActionResult<AiDiet>> {
  if (!isAiConfigured()) return { ok: false, error: SEM_PROVEDOR };

  const user = await requirePatient();

  const reservation = await reserveAiRun({
    profileId: user.id,
    patientId: user.id,
    kind: 'dieta',
    timezone: user.timezone,
  });

  if (!reservation.ok) return { ok: false, error: reservation.error, limited: true };

  try {
    const context = await buildPatientContext(user.id, {
      scopes: ['nutricao', 'saude', 'evolucao', 'checkins'],
    });

    const { diet, model } = await generateDiet({ context });

    const outputId = await persistOutput({
      patientId: user.id,
      createdBy: user.id,
      kind: 'dieta',
      title: diet.titulo,
      content: diet,
      model,
    });

    await completeAiRun(reservation.id, outputId);
    revalidatePath('/nutricao');

    return {
      ok: true,
      data: diet,
      outputId: outputId ?? reservation.id,
      model,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    await releaseAiRun(reservation.id, String(error));
    return { ok: false, error: describeFailure(error) };
  }
}

/* ----------------------------------------------------------------- FICHA -- */

export async function gerarFichaDeTreino(): Promise<AiActionResult<AiWorkoutPlan>> {
  if (!isAiConfigured()) return { ok: false, error: SEM_PROVEDOR };

  const user = await requirePatient();

  const reservation = await reserveAiRun({
    profileId: user.id,
    patientId: user.id,
    kind: 'ficha_treino',
    timezone: user.timezone,
  });

  if (!reservation.ok) return { ok: false, error: reservation.error, limited: true };

  try {
    const context = await buildPatientContext(user.id, {
      scopes: ['treino', 'saude', 'evolucao', 'checkins'],
    });

    const { plan, model } = await generateWorkout({ context });

    const outputId = await persistOutput({
      patientId: user.id,
      createdBy: user.id,
      kind: 'ficha_treino',
      title: plan.titulo,
      content: plan,
      model,
    });

    await completeAiRun(reservation.id, outputId);
    revalidatePath('/treino');

    return {
      ok: true,
      data: plan,
      outputId: outputId ?? reservation.id,
      model,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    await releaseAiRun(reservation.id, String(error));
    return { ok: false, error: describeFailure(error) };
  }
}

/* ------------------------------------------- ANÁLISE DO PROFISSIONAL ----- */

/**
 * Roda a análise guiada pelo protocolo. Quem dispara é o profissional, e a
 * cota debitada é a dele — o paciente não perde a solicitação do mês porque
 * a clínica pediu um parecer.
 */
export async function rodarAnaliseDoProtocolo(
  patientId: string,
): Promise<AiActionResult<AiReport>> {
  if (!isAiConfigured()) return { ok: false, error: SEM_PROVEDOR };

  const pro = await requireProfessional();
  const supabase = await createClient();

  // A RLS já barraria a leitura, mas checar aqui devolve mensagem legível.
  const { data: patient } = await supabase
    .from('profiles')
    .select('id, full_name, professional_id')
    .eq('id', patientId)
    .maybeSingle();

  if (!patient || patient.professional_id !== pro.id) {
    return { ok: false, error: 'Este paciente não está vinculado a você.' };
  }

  const reservation = await reserveAiRun({
    profileId: pro.id,
    patientId,
    kind: 'analise_protocolo',
    timezone: pro.timezone,
  });

  if (!reservation.ok) return { ok: false, error: reservation.error, limited: true };

  try {
    const context = await buildPatientContext(patientId, { scopes: ALL_SCOPES });

    const { report, model } = await generateProtocolAnalysis({
      context,
      patientLabel: patient.full_name,
    });

    const outputId = await persistOutput({
      patientId,
      createdBy: pro.id,
      kind: 'analise_protocolo',
      title: `Análise da IA — ${patient.full_name}`,
      content: report,
      model,
    });

    await completeAiRun(reservation.id, outputId);
    revalidatePath(`/pro/pacientes/${patientId}`);

    return {
      ok: true,
      data: report,
      outputId: outputId ?? reservation.id,
      model,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    await releaseAiRun(reservation.id, String(error));
    return { ok: false, error: describeFailure(error) };
  }
}

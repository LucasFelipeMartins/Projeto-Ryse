import 'server-only';
import { askJson } from '@/lib/ai/provider';
import type { PatientContext } from '@/lib/ai/context';
import type {
  AiDiet,
  AiExercise,
  AiMeal,
  AiReport,
  AiWorkoutDay,
  AiWorkoutPlan,
} from '@/lib/ai/schemas';

/**
 * As instruções e os saneadores das saídas da IA.
 *
 * Duas convicções guiam os prompts:
 *
 *   1. **Não inventar.** O modelo recebe um contexto e é instruído a dizer
 *      "não há dado suficiente" em vez de preencher a lacuna. Num app de
 *      saúde, um número plausível e falso é pior que um campo vazio.
 *   2. **Não diagnosticar.** A IA descreve, compara com faixas de referência
 *      e sugere conduta de estilo de vida. Diagnóstico e prescrição
 *      medicamentosa ficam fora, sempre.
 */

const BASE_SYSTEM = `Você é o assistente clínico da Ryse, uma plataforma de nutrição, treino e exames.

REGRAS INEGOCIÁVEIS:
- Responda SOMENTE com JSON válido, sem markdown e sem texto fora do JSON.
- Use exclusivamente os dados do contexto fornecido. Nunca invente valores,
  exames, pesos ou datas que não estejam lá.
- Quando faltar dado para uma conclusão, diga isso explicitamente no campo
  correspondente em vez de estimar.
- Não faça diagnóstico, não prescreva medicamento e não sugira dose de
  fármaco. Você pode descrever achados, comparar com faixas de referência e
  recomendar conduta de estilo de vida e procura por profissional.
- Escreva em português do Brasil, em tom direto e respeitoso, falando com a
  pessoa ("você"). Sem jargão desnecessário.
- Cada item de lista deve ser uma frase completa e específica ao caso, nunca
  um conselho genérico que serviria para qualquer pessoa.`;

const REPORT_SHAPE = `Formato exato da resposta:
{
  "resumo": "2 a 4 frases situando o momento atual da pessoa",
  "observacoes": ["principais achados, do mais relevante ao menos"],
  "pontosPositivos": ["o que está indo bem, com o dado que sustenta"],
  "pontosAtencao": ["o que merece cuidado, com o dado que sustenta"],
  "evolucao": "como os números mudaram no período; se não há série histórica, diga isso",
  "recomendacoes": ["ações concretas e realizáveis"],
  "proximosPassos": ["o que fazer primeiro, em ordem"]
}`;

/* ----------------------------------------------------------- SANEADORES -- */

const str = (v: unknown, max = 2000): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

const strList = (v: unknown, max = 12, itemMax = 500): string[] =>
  Array.isArray(v)
    ? v
        .map((i) => str(i, itemMax))
        .filter(Boolean)
        .slice(0, max)
    : [];

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n) : fallback;
};

function sanitizeReport(raw: unknown): AiReport {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    resumo: str(r.resumo) || 'Não foi possível resumir com os dados disponíveis.',
    observacoes: strList(r.observacoes),
    pontosPositivos: strList(r.pontosPositivos),
    pontosAtencao: strList(r.pontosAtencao),
    evolucao: str(r.evolucao) || 'Sem série histórica suficiente para comparar.',
    recomendacoes: strList(r.recomendacoes),
    proximosPassos: strList(r.proximosPassos, 8),
  };
}

function sanitizeDiet(raw: unknown): AiDiet {
  const d = (raw ?? {}) as Record<string, unknown>;
  const refeicoes = Array.isArray(d.refeicoes) ? d.refeicoes : [];

  return {
    titulo: str(d.titulo, 140) || 'Plano alimentar sugerido',
    kcalAlvo: num(d.kcalAlvo),
    proteina: num(d.proteina),
    carboidrato: num(d.carboidrato),
    gordura: num(d.gordura),
    estrategia: str(d.estrategia),
    refeicoes: refeicoes.slice(0, 8).map((m): AiMeal => {
      const meal = (m ?? {}) as Record<string, unknown>;
      return {
        nome: str(meal.nome, 60) || 'Refeição',
        // Aceita "8h", "08:00" ou lixo; normaliza para HH:MM.
        horario: normalizeTime(str(meal.horario, 10)),
        titulo: str(meal.titulo, 140),
        kcal: num(meal.kcal),
        proteina: num(meal.proteina),
        carboidrato: num(meal.carboidrato),
        gordura: num(meal.gordura),
        itens: strList(meal.itens, 12, 200),
      };
    }),
    orientacoes: strList(d.orientacoes, 10),
  };
}

function normalizeTime(value: string): string {
  const match = value.match(/(\d{1,2})[:h]?(\d{2})?/);
  if (!match) return '';
  const h = Math.min(23, Number(match[1] ?? 0));
  const m = Math.min(59, Number(match[2] ?? 0));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function sanitizeWorkout(raw: unknown): AiWorkoutPlan {
  const w = (raw ?? {}) as Record<string, unknown>;
  const fichas = Array.isArray(w.fichas) ? w.fichas : [];

  return {
    titulo: str(w.titulo, 140) || 'Ficha de treino sugerida',
    divisao: str(w.divisao, 120),
    estrategia: str(w.estrategia),
    fichas: fichas.slice(0, 7).map((f, i): AiWorkoutDay => {
      const dia = (f ?? {}) as Record<string, unknown>;
      const exercicios = Array.isArray(dia.exercicios) ? dia.exercicios : [];

      return {
        letra: str(dia.letra, 3) || String.fromCharCode(65 + i),
        titulo: str(dia.titulo, 140),
        foco: str(dia.foco, 120),
        duracaoMin: Math.min(180, Math.max(10, num(dia.duracaoMin, 50))),
        exercicios: exercicios.slice(0, 14).map((e): AiExercise => {
          const ex = (e ?? {}) as Record<string, unknown>;
          return {
            nome: str(ex.nome, 120) || 'Exercício',
            musculo: str(ex.musculo, 60),
            series: Math.min(10, Math.max(1, num(ex.series, 3))),
            repeticoes: str(ex.repeticoes, 30) || '10',
            carga: str(ex.carga, 40) || 'a definir',
            descanso: str(ex.descanso, 40) || '60s',
            observacao: str(ex.observacao, 200) || null,
          };
        }),
      };
    }),
    orientacoes: strList(w.orientacoes, 10),
  };
}

/* ------------------------------------------------------------ RELATÓRIOS -- */

export type ReportArea = 'exames' | 'saude' | 'treino' | 'nutricao';

const REPORT_FOCUS: Record<ReportArea, string> = {
  exames: `Foque nos exames: resultados, comparação com as faixas de referência,
alterações entre coletas, tendências e o que merece atenção médica. Não
diagnostique — descreva o achado e indique quando procurar avaliação.`,

  saude: `Foque na saúde geral: dados cadastrados, evolução corporal, respostas
dos check-ins, indicadores de sono, energia, dor e fome, e o histórico
informado. Relacione os sinais entre si quando houver base para isso.`,

  treino: `Foque no treino: frequência real das sessões, consistência ao longo
das semanas, duração, esforço percebido, aderência ao plano prescrito e
evolução de desempenho. Compare o planejado com o realizado.`,

  nutricao: `Foque na nutrição: adesão às refeições prescritas, consistência
semanal, relação entre o plano e a evolução de peso e composição corporal,
e coerência com o objetivo declarado.`,
};

export async function generateReport(input: {
  area: ReportArea;
  context: PatientContext;
  patientLabel?: string;
}): Promise<{ report: AiReport; model: string }> {
  const detail = input.context.protocol?.detailLevel ?? 'completo';

  const depth =
    detail === 'resumido'
      ? 'Seja enxuto: no máximo 3 itens por lista.'
      : detail === 'padrao'
        ? 'Até 5 itens por lista.'
        : 'Pode usar até 8 itens por lista, cobrindo o caso em profundidade.';

  const { data, model } = await askJson<unknown>({
    system: `${BASE_SYSTEM}

${REPORT_FOCUS[input.area]}

${depth}

${REPORT_SHAPE}`,
    user: `Gere o relatório da área "${input.area}"${
      input.patientLabel ? ` para ${input.patientLabel}` : ''
    }.

CONTEXTO DISPONÍVEL:

${input.context.text}`,
    temperature: 0.2,
    maxTokens: 3000,
  });

  return { report: sanitizeReport(data), model };
}

/* ----------------------------------------------------------------- DIETA -- */

export async function generateDiet(input: {
  context: PatientContext;
}): Promise<{ diet: AiDiet; model: string }> {
  const { data, model } = await askJson<unknown>({
    system: `${BASE_SYSTEM}

Monte um plano alimentar diário coerente com o objetivo, o peso, a altura, a
rotina, as preferências e as restrições da pessoa. Respeite integralmente as
restrições alimentares: um item proibido invalida o plano inteiro.

Distribua as calorias entre 4 e 6 refeições, com horários compatíveis com a
rotina informada. Use alimentos comuns no Brasil e porções em medidas
caseiras ou gramas. A soma das calorias das refeições deve bater com o alvo.

Formato exato da resposta:
{
  "titulo": "nome curto do plano",
  "kcalAlvo": 0,
  "proteina": 0,
  "carboidrato": 0,
  "gordura": 0,
  "estrategia": "2 a 3 frases explicando a lógica do plano para este caso",
  "refeicoes": [
    {
      "nome": "Café da manhã",
      "horario": "07:00",
      "titulo": "resumo curto da refeição",
      "kcal": 0,
      "proteina": 0,
      "carboidrato": 0,
      "gordura": 0,
      "itens": ["alimento com quantidade"]
    }
  ],
  "orientacoes": ["orientações práticas de execução"]
}`,
    user: `Crie a dieta personalizada.

CONTEXTO DISPONÍVEL:

${input.context.text}`,
    temperature: 0.4,
    maxTokens: 4000,
  });

  return { diet: sanitizeDiet(data), model };
}

/* ----------------------------------------------------------- FICHA/TREINO */

export async function generateWorkout(input: {
  context: PatientContext;
}): Promise<{ plan: AiWorkoutPlan; model: string }> {
  const { data, model } = await askJson<unknown>({
    system: `${BASE_SYSTEM}

Monte uma ficha de treino coerente com o objetivo, o nível, a disponibilidade
semanal e as restrições da pessoa. O número de fichas deve bater com os dias
de treino disponíveis — não prescreva 5 dias para quem informou 3.

Para iniciante, priorize exercícios de padrão simples e progressão por
repetição. Se houver dor ou limitação nos check-ins, adapte e diga o porquê
na observação do exercício.

Formato exato da resposta:
{
  "titulo": "nome curto da ficha",
  "divisao": "ex.: Full body 3x, Upper/Lower, ABC",
  "estrategia": "2 a 3 frases explicando a lógica para este caso",
  "fichas": [
    {
      "letra": "A",
      "titulo": "nome do treino",
      "foco": "grupos trabalhados",
      "duracaoMin": 50,
      "exercicios": [
        {
          "nome": "Agachamento livre",
          "musculo": "Quadríceps",
          "series": 3,
          "repeticoes": "8-10",
          "carga": "moderada, RIR 2",
          "descanso": "90s",
          "observacao": null
        }
      ]
    }
  ],
  "orientacoes": ["aquecimento, progressão de carga, sinais de alerta"]
}`,
    user: `Crie a ficha de treino personalizada.

CONTEXTO DISPONÍVEL:

${input.context.text}`,
    temperature: 0.4,
    maxTokens: 4000,
  });

  return { plan: sanitizeWorkout(data), model };
}

/* --------------------------------------------- ANÁLISE DO PROFISSIONAL --- */

/**
 * Análise disparada pelo profissional, guiada pelo protocolo dele.
 * A estrutura é a mesma dos relatórios; muda o recorte.
 */
export async function generateProtocolAnalysis(input: {
  context: PatientContext;
  patientLabel: string;
}): Promise<{ report: AiReport; model: string }> {
  const p = input.context.protocol;

  const { data, model } = await askJson<unknown>({
    system: `${BASE_SYSTEM}

Você está apoiando um profissional de saúde, não o paciente. Escreva para
quem tem formação clínica: pode ser técnico, mas continue sem diagnosticar e
sem prescrever medicamento.

${p ? `O profissional definiu como objetivo principal "${p.objective}", com prioridade ${p.priority} e detalhamento ${p.detailLevel}.` : ''}
${p?.notes ? `Observações do profissional a considerar: ${p.notes}` : ''}

Organize a resposta ligando cada conclusão ao dado que a sustenta.

${REPORT_SHAPE}`,
    user: `Analise o caso de ${input.patientLabel} segundo o protocolo configurado.

CONTEXTO DISPONÍVEL:

${input.context.text}`,
    temperature: 0.2,
    maxTokens: 3500,
  });

  return { report: sanitizeReport(data), model };
}

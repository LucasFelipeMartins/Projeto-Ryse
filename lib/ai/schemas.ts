/**
 * Formato das saídas da IA.
 *
 * Fica fora de `server-only` de propósito: os componentes de cliente
 * renderizam esses objetos, então o tipo precisa atravessar a fronteira.
 *
 * Todo campo tem um saneador correspondente em `lib/ai/generate.ts`. Confiar
 * no formato prometido pelo modelo seria ingênuo — um relatório com
 * `recomendacoes: "texto"` em vez de array quebraria a tela.
 */

/** Estrutura fixa dos relatórios, igual nas quatro áreas. */
export type AiReport = {
  resumo: string;
  observacoes: string[];
  pontosPositivos: string[];
  pontosAtencao: string[];
  evolucao: string;
  recomendacoes: string[];
  proximosPassos: string[];
};

export type AiMeal = {
  nome: string;
  horario: string;
  titulo: string;
  kcal: number;
  proteina: number;
  carboidrato: number;
  gordura: number;
  itens: string[];
};

export type AiDiet = {
  titulo: string;
  kcalAlvo: number;
  proteina: number;
  carboidrato: number;
  gordura: number;
  estrategia: string;
  refeicoes: AiMeal[];
  orientacoes: string[];
};

export type AiExercise = {
  nome: string;
  musculo: string;
  series: number;
  repeticoes: string;
  carga: string;
  descanso: string;
  observacao: string | null;
};

export type AiWorkoutDay = {
  letra: string;
  titulo: string;
  foco: string;
  duracaoMin: number;
  exercicios: AiExercise[];
};

export type AiWorkoutPlan = {
  titulo: string;
  divisao: string;
  estrategia: string;
  fichas: AiWorkoutDay[];
  orientacoes: string[];
};

/** O que é guardado em `ai_outputs.content`. */
export type AiOutputContent = AiReport | AiDiet | AiWorkoutPlan;

/**
 * Aviso obrigatório em toda saída.
 *
 * Não é enfeite jurídico: a plataforma inteira é construída sobre a ideia de
 * que a IA propõe e um humano decide. O texto precisa dizer isso onde o
 * usuário lê o resultado.
 */
export const AI_DISCLAIMER =
  'Conteúdo gerado por inteligência artificial a partir dos seus registros. ' +
  'É uma sugestão de partida e não substitui avaliação de um profissional de ' +
  'saúde habilitado — principalmente diante de sintomas, exames alterados ou ' +
  'condições preexistentes.';

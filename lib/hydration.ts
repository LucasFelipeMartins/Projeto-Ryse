/**
 * Meta diária de água.
 *
 * A fórmula mora aqui e em nenhum outro lugar. Guardar o resultado no banco
 * criaria uma segunda verdade que envelheceria no instante em que o paciente
 * registrasse um peso novo — por isso a meta é **calculada na leitura**, a
 * partir do peso mais recente.
 *
 * Base: 35 ml por quilo é a referência corrente para adultos. A idade ajusta
 * essa taxa (a capacidade renal de concentrar urina cai com os anos), a
 * altura entra como correção fina para biotipos longilíneos, e o treino soma
 * a perda por suor.
 *
 * Não é prescrição clínica: é uma estimativa de partida, que o profissional
 * pode substituir por um valor fixo (`water_goal_override_ml`).
 */

/** Faixas de ml por kg de peso corporal. */
const ML_POR_KG = {
  jovem: 40, // < 18 anos
  adulto: 35, // 18–55
  maduro: 30, // 56–65
  idoso: 25, // > 65
} as const;

/** Perda extra estimada por dia de treino na semana, em ml. */
const ML_POR_DIA_DE_TREINO = 120;

/** Ajuste por nível de atividade fora do treino. */
const FATOR_ATIVIDADE: Record<string, number> = {
  sedentario: 1,
  leve: 1.03,
  moderado: 1.07,
  intenso: 1.12,
  atleta: 1.18,
};

export const META_MINIMA_ML = 1500;
export const META_MAXIMA_ML = 6000;

export type HydrationProfile = {
  weightKg: number | null;
  heightCm: number | null;
  birthDate: string | null;
  activityLevel: string | null;
  trainingDays: number | null;
  /** Valor fixo prescrito. Quando presente, vence o cálculo. */
  overrideMl: number | null;
};

export type HydrationGoal = {
  goalMl: number;
  /** `true` quando o número veio de uma prescrição, não do cálculo. */
  manual: boolean;
  /**
   * O que entrou na conta — o app mostra isso para o usuário entender de
   * onde saiu o número, em vez de exibir uma meta sem explicação.
   */
  basis: {
    weightKg: number | null;
    mlPerKg: number;
    age: number | null;
    trainingBonusMl: number;
    activityFactor: number;
  };
};

/** Meta usada enquanto não houver peso registrado. */
export const META_PADRAO_ML = 2500;

export function idadeEmAnos(birthDate: string | null, hoje = new Date()): number | null {
  if (!birthDate) return null;
  const nascimento = new Date(`${birthDate}T12:00:00`);
  if (Number.isNaN(nascimento.getTime())) return null;

  let anos = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) anos -= 1;

  return anos >= 0 && anos < 130 ? anos : null;
}

function mlPorKgPara(idade: number | null): number {
  if (idade === null) return ML_POR_KG.adulto;
  if (idade < 18) return ML_POR_KG.jovem;
  if (idade <= 55) return ML_POR_KG.adulto;
  if (idade <= 65) return ML_POR_KG.maduro;
  return ML_POR_KG.idoso;
}

/**
 * Correção pela altura.
 *
 * Duas pessoas de 70 kg com 1,60 m e 1,90 m têm superfícies corporais
 * diferentes, e quem tem mais superfície perde mais água. O ajuste é
 * deliberadamente pequeno (±6%): o peso continua sendo o fator dominante.
 */
function fatorAltura(heightCm: number | null): number {
  if (!heightCm || heightCm < 120 || heightCm > 230) return 1;
  const desvio = (heightCm - 170) / 100; // 1,80 m -> +0,10
  return 1 + Math.max(-0.06, Math.min(0.06, desvio * 0.6));
}

/**
 * Calcula a meta diária, em ml, arredondada para múltiplos de 50 — número
 * redondo é mais fácil de perseguir do que "2.847 ml".
 */
export function computeWaterGoal(profile: HydrationProfile): HydrationGoal {
  const idade = idadeEmAnos(profile.birthDate);
  const mlPorKg = mlPorKgPara(idade);
  const fatorAtividade = FATOR_ATIVIDADE[profile.activityLevel ?? ''] ?? 1;
  const bonusTreino = Math.max(0, Math.min(7, profile.trainingDays ?? 0)) * ML_POR_DIA_DE_TREINO;

  if (profile.overrideMl) {
    return {
      goalMl: profile.overrideMl,
      manual: true,
      basis: {
        weightKg: profile.weightKg,
        mlPerKg: mlPorKg,
        age: idade,
        trainingBonusMl: bonusTreino,
        activityFactor: fatorAtividade,
      },
    };
  }

  // Sem peso não há fórmula: devolve o padrão em vez de inventar um número.
  if (!profile.weightKg || profile.weightKg < 20 || profile.weightKg > 400) {
    return {
      goalMl: META_PADRAO_ML,
      manual: false,
      basis: {
        weightKg: null,
        mlPerKg: mlPorKg,
        age: idade,
        trainingBonusMl: 0,
        activityFactor: fatorAtividade,
      },
    };
  }

  const bruto =
    (profile.weightKg * mlPorKg * fatorAltura(profile.heightCm) + bonusTreino) *
    fatorAtividade;

  const arredondado = Math.round(bruto / 50) * 50;

  return {
    goalMl: Math.max(META_MINIMA_ML, Math.min(META_MAXIMA_ML, arredondado)),
    manual: false,
    basis: {
      weightKg: profile.weightKg,
      mlPerKg: mlPorKg,
      age: idade,
      trainingBonusMl: bonusTreino,
      activityFactor: fatorAtividade,
    },
  };
}

/** Frase curta que explica a meta na interface. */
export function explainWaterGoal(goal: HydrationGoal): string {
  if (goal.manual) return 'Meta definida pelo seu profissional.';
  if (goal.basis.weightKg === null) {
    return 'Meta padrão — registre seu peso para calcularmos a sua.';
  }

  const peso = goal.basis.weightKg.toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
  });
  const extra = goal.basis.trainingBonusMl > 0 ? ' + treino' : '';

  return `Calculada a partir de ${peso} kg × ${goal.basis.mlPerKg} ml${extra}.`;
}

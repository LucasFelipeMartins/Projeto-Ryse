import 'server-only';

/**
 * Terceira camada de verificação: o documento *parece* um exame de saúde?
 *
 * Assinatura de arquivo e tamanho não distinguem um hemograma de um recibo de
 * restaurante — os dois são PDFs válidos de 200 KB. Aqui o texto é extraído e
 * pontuado contra o vocabulário de laudos laboratoriais.
 *
 * É uma heurística, e assumidamente conservadora: ela barra o que é
 * claramente alheio (nota fiscal, contrato, print de conversa) e deixa passar
 * o que tem cara de exame. A classificação fina fica para o analisador de IA
 * (`lib/ai/analyzer.ts`), que roda depois.
 */

/** Termos que aparecem em praticamente todo laudo laboratorial brasileiro. */
const STRUCTURAL_TERMS = [
  'valor de referência',
  'valores de referência',
  'resultado',
  'material',
  'método',
  'metodologia',
  'unidade',
  'laboratório',
  'exame',
  'paciente',
  'coleta',
  'crm',
  'responsável técnico',
];

/** Analitos e unidades — o vocabulário específico de exames. */
const CLINICAL_TERMS = [
  'hemograma',
  'hemácias',
  'hemoglobina',
  'hematócrito',
  'leucócitos',
  'plaquetas',
  'glicose',
  'glicemia',
  'colesterol',
  'triglicerídeos',
  'hdl',
  'ldl',
  'creatinina',
  'ureia',
  'tsh',
  't4 livre',
  'ferritina',
  'vitamina d',
  'vitamina b12',
  'testosterona',
  'cortisol',
  'insulina',
  'ácido úrico',
  'tgo',
  'tgp',
  'ast',
  'alt',
  'pcr',
  'sódio',
  'potássio',
  'magnésio',
  'albumina',
  'bilirrubina',
  'hba1c',
  'hemoglobina glicada',
  'densitometria',
  'ultrassonografia',
  'ressonância',
  'tomografia',
  'bioimpedância',
];

/** Unidades de medida laboratoriais. */
const UNIT_PATTERN =
  /\b(mg\/dl|g\/dl|ng\/ml|pg\/ml|µg\/dl|ug\/dl|mmol\/l|mg\/l|ui\/l|u\/l|µui\/ml|uui\/ml|mil\/mm3|milhões\/mm3|%|mm3)\b/gi;

/** Sinais de que o documento é outra coisa. */
const NEGATIVE_TERMS = [
  'nota fiscal',
  'cupom fiscal',
  'danfe',
  'cnpj do emitente',
  'boleto',
  'código de barras',
  'contrato de prestação',
  'currículo',
  'curriculum vitae',
  'fatura de energia',
  'extrato bancário',
];

export type ContentCheck = {
  /** `true` quando o texto tem cara de documento de saúde. */
  looksClinical: boolean;
  /** 0 a 100 — usado só para diagnóstico e para o log. */
  score: number;
  /** Texto extraído, reaproveitado depois pela análise de IA. */
  text: string;
  /** `true` quando não foi possível extrair texto (PDF escaneado, imagem). */
  textUnavailable: boolean;
  reason?: string;
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const countHits = (haystack: string, terms: string[]) =>
  terms.filter((t) => haystack.includes(normalize(t))).length;

/** Extrai o texto de um PDF. Retorna string vazia se não houver camada de texto. */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(bytes);
    // Com mergePages: true o pacote já devolve uma única string.
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch {
    // PDF malformado ou sem camada de texto: quem decide é o analisador.
    return '';
  }
}

/**
 * Pontua o texto extraído.
 *
 * O corte é 3: precisa de pelo menos três sinais entre termos estruturais,
 * analitos e unidades. Um recibo tem "valor" e "total", mas não tem
 * "valor de referência" nem "mg/dL".
 */
export function scoreHealthText(raw: string): ContentCheck {
  const text = raw.trim();

  if (text.length < 120) {
    return {
      looksClinical: false,
      score: 0,
      text,
      textUnavailable: true,
      reason: 'Não foi possível ler texto neste arquivo.',
    };
  }

  const hay = normalize(text);

  const negatives = countHits(hay, NEGATIVE_TERMS);
  if (negatives > 0) {
    return {
      looksClinical: false,
      score: 0,
      text,
      textUnavailable: false,
      reason: 'Este documento parece ser fiscal ou administrativo, não um exame.',
    };
  }

  const structural = countHits(hay, STRUCTURAL_TERMS);
  const clinical = countHits(hay, CLINICAL_TERMS);
  const units = new Set(text.match(UNIT_PATTERN)?.map((u) => u.toLowerCase()) ?? []).size;

  // Analitos pesam mais: são o que de fato caracteriza um laudo.
  const signals = structural + clinical * 2 + Math.min(units, 5);
  const score = Math.min(100, signals * 8);
  const looksClinical = structural >= 1 && clinical + units >= 2;

  return {
    looksClinical,
    score,
    text,
    textUnavailable: false,
    reason: looksClinical
      ? undefined
      : 'Não encontramos indicadores de exame neste documento (analitos, unidades ou valores de referência).',
  };
}

/** Roda a checagem completa sobre um PDF. */
export async function checkPdfContent(bytes: Uint8Array): Promise<ContentCheck> {
  return scoreHealthText(await extractPdfText(bytes));
}

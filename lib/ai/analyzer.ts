import 'server-only';

/**
 * Contrato do analisador de documentos de saúde.
 *
 * Deliberadamente neutro quanto ao provedor: o resto do app depende só destes
 * tipos. Trocar de fornecedor é escrever um novo objeto que satisfaça
 * `DocumentAnalyzer` e devolvê-lo em `getAnalyzer()` — nenhuma tela muda.
 *
 * A implementação com a API da OpenAI está marcada com TODO em
 * `lib/ai/openai.ts`.
 */

export type DocumentKind =
  | 'exame_laboratorial'
  | 'laudo_imagem'
  | 'receita'
  | 'atestado'
  | 'outro_saude'
  | 'nao_relacionado';

/** Veredito da triagem: isto é mesmo um documento de saúde? */
export type TriageResult = {
  kind: DocumentKind;
  /** 0 a 1 — quão seguro o modelo está da classificação. */
  confidence: number;
  /** `false` faz o upload ser rejeitado e o arquivo apagado. */
  accepted: boolean;
  /** Motivo em português, mostrado ao paciente quando rejeitado. */
  reason: string;
  /** `true` se o modelo detectou dados de outra pessoa no documento. */
  possiblyThirdParty?: boolean;
};

export type ExtractedMarker = {
  name: string;
  value: string;
  unit: string | null;
  referenceRange: string | null;
  status: 'ok' | 'atencao' | 'alterado' | 'indeterminado';
};

export type AnalysisResult = {
  /** Resumo em linguagem clara, para o paciente. */
  summary: string;
  collectedOn: string | null;
  lab: string | null;
  markers: ExtractedMarker[];
  /** Pontos que merecem atenção do profissional. */
  highlights: string[];
};

export type AnalyzerInput = {
  bytes: Uint8Array;
  mime: string;
  filename: string;
  /** Texto já extraído, quando houver. Evita reenviar o PDF inteiro. */
  text?: string;
};

export class AnalyzerNotConfiguredError extends Error {
  constructor() {
    super('Nenhum provedor de IA configurado.');
    this.name = 'AnalyzerNotConfiguredError';
  }
}

export interface DocumentAnalyzer {
  /** Nome do provedor, gravado junto do resultado para auditoria. */
  readonly provider: string;

  /** Passo 1 — barato: o documento é mesmo um exame? */
  triage(input: AnalyzerInput): Promise<TriageResult>;

  /** Passo 2 — caro: só roda se a triagem aceitou. */
  analyze(input: AnalyzerInput): Promise<AnalysisResult>;
}

/* ----------------------------------------------------------- INSTRUÇÕES -- */

/**
 * Instruções compartilhadas por qualquer provedor.
 *
 * Ficam aqui, e não dentro de uma implementação, para que trocar de
 * fornecedor não signifique reescrever as regras clínicas.
 */
export const TRIAGE_INSTRUCTIONS = `
Você classifica documentos enviados por pacientes num app de saúde.

Responda APENAS com JSON no formato:
{"kind": "...", "confidence": 0.0, "accepted": true, "reason": "...", "possiblyThirdParty": false}

Valores possíveis de "kind":
- exame_laboratorial: resultado de exame de sangue, urina, fezes, hormônios
- laudo_imagem: ultrassom, raio-x, tomografia, ressonância, densitometria
- receita: prescrição de medicamento ou suplemento
- atestado: atestado ou relatório médico
- outro_saude: documento de saúde que não se encaixa acima
- nao_relacionado: qualquer coisa que não seja documento de saúde

Regras:
- "accepted" é false quando kind for "nao_relacionado".
- "reason" explica em português claro, em uma frase, dirigida ao paciente.
  Quando rejeitar, diga o que o documento aparenta ser e o que ele deveria
  enviar no lugar.
- "possiblyThirdParty" é true se o documento tiver nome de outra pessoa.
- Não invente conteúdo. Se o documento estiver ilegível, use kind
  "nao_relacionado" e explique que não foi possível ler.
`.trim();

export const ANALYSIS_INSTRUCTIONS = `
Você extrai dados de um exame de saúde para revisão de um profissional.

Responda APENAS com JSON no formato:
{
  "summary": "...",
  "collectedOn": "AAAA-MM-DD ou null",
  "lab": "nome do laboratório ou null",
  "markers": [
    {"name":"...","value":"...","unit":"...","referenceRange":"...","status":"ok"}
  ],
  "highlights": ["..."]
}

Regras:
- "status" é "alterado" quando o valor está fora da faixa de referência,
  "atencao" quando está no limite, "ok" quando está dentro, e
  "indeterminado" quando não há faixa de referência no documento.
- Transcreva os valores exatamente como aparecem. NÃO calcule, converta nem
  estime nada que não esteja escrito.
- "summary" descreve o que o exame mostra em linguagem simples, sem
  diagnosticar e sem recomendar tratamento.
- "highlights" lista apenas o que está fora da faixa. Lista vazia se estiver
  tudo normal.
- Se um campo não estiver no documento, use null. Nunca preencha por dedução.
`.trim();

/* ------------------------------------------------------------- FÁBRICA -- */

/**
 * Devolve o analisador configurado, ou `null` quando não há provedor.
 *
 * Com `null`, o upload e todas as validações determinísticas continuam
 * funcionando — o documento fica com status `aguardando_analise` até que um
 * provedor exista.
 */
export async function getAnalyzer(): Promise<DocumentAnalyzer | null> {
  if (process.env.OPENAI_API_KEY) {
    const { createOpenAiAnalyzer } = await import('@/lib/ai/openai');
    return createOpenAiAnalyzer();
  }

  return null;
}

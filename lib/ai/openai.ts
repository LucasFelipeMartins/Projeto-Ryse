import 'server-only';
import OpenAI from 'openai';
import {
  ANALYSIS_INSTRUCTIONS,
  TRIAGE_INSTRUCTIONS,
  type AnalysisResult,
  type AnalyzerInput,
  type DocumentAnalyzer,
  type TriageResult,
} from '@/lib/ai/analyzer';

/**
 * Análise de documentos com a API da OpenAI.
 *
 * Dois modelos, configuráveis por variável de ambiente:
 *   - triagem  — chamada curta e barata, decide se o documento é um exame;
 *   - análise  — só roda se a triagem aceitou.
 *
 * `gpt-4o-mini` dá conta das duas e custa cerca de US$ 0,002 por documento.
 * Para extrair valores de laudos mais bagunçados, subir a análise para
 * `gpt-4o` costuma valer a pena.
 */

const TRIAGE_MODEL = process.env.OPENAI_TRIAGE_MODEL ?? 'gpt-4o-mini';
const ANALYSIS_MODEL = process.env.OPENAI_ANALYSIS_MODEL ?? 'gpt-4o-mini';

/**
 * Teto do texto enviado. Um laudo de 30 páginas raramente passa de 60 mil
 * caracteres; acima disso, recusamos em vez de cortar em silêncio — um exame
 * truncado no meio produziria extração errada, que é pior que erro nenhum.
 */
const MAX_TEXT_CHARS = 120_000;

export class DocumentTooLargeError extends Error {
  constructor() {
    super('Documento longo demais para análise automática.');
    this.name = 'DocumentTooLargeError';
  }
}

function client() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    // Documento grande com visão pode passar de 30 s.
    timeout: 90_000,
    maxRetries: 2,
  });
}

/**
 * Monta o conteúdo da mensagem.
 *
 * PDF vai como texto já extraído (`unpdf` fez isso na camada 3) — é muito
 * mais barato que mandar as páginas como imagem. Foto vai como data URL,
 * usando a capacidade de visão do modelo.
 */
function buildContent(
  input: AnalyzerInput,
): OpenAI.Chat.Completions.ChatCompletionContentPart[] {
  const header = `Arquivo enviado pelo paciente: ${input.filename}`;

  if (input.mime === 'application/pdf') {
    const text = (input.text ?? '').trim();

    if (!text) {
      // PDF escaneado: sem camada de texto, não há o que mandar como texto.
      // A imagem das páginas exigiria rasterizar — fora do escopo por ora.
      return [
        {
          type: 'text',
          text: `${header}\n\n[PDF sem camada de texto — provavelmente digitalizado. Classifique como não relacionado e peça uma foto legível.]`,
        },
      ];
    }

    if (text.length > MAX_TEXT_CHARS) throw new DocumentTooLargeError();

    return [{ type: 'text', text: `${header}\n\nConteúdo:\n\n${text}` }];
  }

  const base64 = Buffer.from(input.bytes).toString('base64');

  return [
    { type: 'text', text: header },
    {
      type: 'image_url',
      image_url: { url: `data:${input.mime};base64,${base64}`, detail: 'high' },
    },
  ];
}

async function ask(model: string, system: string, input: AnalyzerInput) {
  const response = await client().chat.completions.create({
    model,
    // Força JSON válido: sem isso o modelo às vezes embrulha em ```json.
    response_format: { type: 'json_object' },
    // Extração de laudo não é tarefa criativa.
    temperature: 0,
    max_tokens: 4096,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: buildContent(input) },
    ],
  });

  return response.choices[0]?.message?.content ?? null;
}

export function createOpenAiAnalyzer(): DocumentAnalyzer {
  return {
    provider: 'openai',

    async triage(input: AnalyzerInput): Promise<TriageResult> {
      return parseTriage(await ask(TRIAGE_MODEL, TRIAGE_INSTRUCTIONS, input));
    },

    async analyze(input: AnalyzerInput): Promise<AnalysisResult> {
      const parsed = parseAnalysis(await ask(ANALYSIS_MODEL, ANALYSIS_INSTRUCTIONS, input));

      if (!parsed) {
        throw new Error('Resposta da análise fora do formato esperado.');
      }
      return parsed;
    },
  };
}

/* --------------------------------------------------- PARSERS DEFENSIVOS -- */

/**
 * Converte a resposta do modelo em `TriageResult`, com defaults seguros.
 *
 * O default de `accepted` é `false`: se a resposta vier quebrada, o documento
 * é recusado em vez de passar sem checagem.
 */
export function parseTriage(raw: string | null): TriageResult {
  const fallback: TriageResult = {
    kind: 'nao_relacionado',
    confidence: 0,
    accepted: false,
    reason: 'Não foi possível analisar este documento. Tente reenviar.',
  };

  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Partial<TriageResult>;
    const kinds = [
      'exame_laboratorial',
      'laudo_imagem',
      'receita',
      'atestado',
      'outro_saude',
      'nao_relacionado',
    ];

    if (!parsed.kind || !kinds.includes(parsed.kind)) return fallback;

    return {
      kind: parsed.kind,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
      // Rejeita sempre que a classificação for "não relacionado", mesmo que o
      // modelo tenha marcado accepted: true.
      accepted: parsed.accepted === true && parsed.kind !== 'nao_relacionado',
      reason:
        typeof parsed.reason === 'string' && parsed.reason.trim()
          ? parsed.reason.trim()
          : fallback.reason,
      possiblyThirdParty: parsed.possiblyThirdParty === true,
    };
  } catch {
    return fallback;
  }
}

type ExtractedStatus = 'ok' | 'atencao' | 'alterado' | 'indeterminado';

export function parseAnalysis(raw: string | null): AnalysisResult | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<AnalysisResult>;
    if (typeof parsed.summary !== 'string') return null;

    const statuses = ['ok', 'atencao', 'alterado', 'indeterminado'];

    return {
      summary: parsed.summary.trim(),
      collectedOn:
        typeof parsed.collectedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.collectedOn)
          ? parsed.collectedOn
          : null,
      lab: typeof parsed.lab === 'string' ? parsed.lab.slice(0, 120) : null,
      markers: Array.isArray(parsed.markers)
        ? parsed.markers
            .filter((m) => m && typeof m.name === 'string' && typeof m.value === 'string')
            .slice(0, 80)
            .map((m) => ({
              name: String(m.name).slice(0, 120),
              value: String(m.value).slice(0, 60),
              unit: typeof m.unit === 'string' ? m.unit.slice(0, 20) : null,
              referenceRange:
                typeof m.referenceRange === 'string' ? m.referenceRange.slice(0, 60) : null,
              status: statuses.includes(m.status as string)
                ? (m.status as ExtractedStatus)
                : 'indeterminado',
            }))
        : [],
      highlights: Array.isArray(parsed.highlights)
        ? parsed.highlights.filter((h): h is string => typeof h === 'string').slice(0, 10)
        : [],
    };
  } catch {
    return null;
  }
}

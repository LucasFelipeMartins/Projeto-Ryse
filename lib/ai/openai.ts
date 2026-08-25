import 'server-only';
import {
  AnalyzerNotConfiguredError,
  ANALYSIS_INSTRUCTIONS,
  TRIAGE_INSTRUCTIONS,
  type AnalysisResult,
  type AnalyzerInput,
  type DocumentAnalyzer,
  type TriageResult,
} from '@/lib/ai/analyzer';

/**
 * Implementação com a API da OpenAI.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ TODO — ainda não implementado.                                          │
 * │                                                                         │
 * │ Passos para ligar:                                                      │
 * │   1. npm install openai                                                 │
 * │   2. OPENAI_API_KEY=sk-... no .env.local (sem NEXT_PUBLIC_)             │
 * │   3. Preencher triage() e analyze() abaixo                              │
 * │                                                                         │
 * │ Enquanto isso, `getAnalyzer()` devolve null e o app segue funcionando:  │
 * │ o upload e as validações determinísticas rodam normalmente, e o         │
 * │ documento fica com status `aguardando_analise`.                         │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Esboço da chamada, para referência:
 *
 *   import OpenAI from 'openai';
 *   const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 *
 *   const response = await client.chat.completions.create({
 *     model: 'gpt-4o',
 *     response_format: { type: 'json_object' },
 *     messages: [
 *       { role: 'system', content: TRIAGE_INSTRUCTIONS },
 *       {
 *         role: 'user',
 *         content: [
 *           { type: 'text', text: `Arquivo: ${input.filename}` },
 *           // PDF  -> mande input.text (já extraído, mais barato)
 *           // imagem -> { type: 'image_url', image_url: { url: dataUrl } }
 *         ],
 *       },
 *     ],
 *   });
 *
 *   return parseTriage(response.choices[0].message.content);
 *
 * Duas coisas a não esquecer ao implementar:
 *   - a chave NUNCA leva o prefixo NEXT_PUBLIC_ (iria para o navegador);
 *   - valide a resposta com `parseTriage` / `parseAnalysis` antes de gravar —
 *     o modelo pode devolver JSON fora do formato combinado.
 */
export function createOpenAiAnalyzer(): DocumentAnalyzer {
  return {
    provider: 'openai',

    async triage(_input: AnalyzerInput): Promise<TriageResult> {
      throw new AnalyzerNotConfiguredError();
    },

    async analyze(_input: AnalyzerInput): Promise<AnalysisResult> {
      throw new AnalyzerNotConfiguredError();
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

export function parseAnalysis(raw: string | null): AnalysisResult | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<AnalysisResult>;
    if (typeof parsed.summary !== 'string') return null;

    const statuses = ['ok', 'atencao', 'alterado', 'indeterminado'];

    return {
      summary: parsed.summary.trim(),
      collectedOn: typeof parsed.collectedOn === 'string' ? parsed.collectedOn : null,
      lab: typeof parsed.lab === 'string' ? parsed.lab : null,
      markers: Array.isArray(parsed.markers)
        ? parsed.markers
            .filter((m) => m && typeof m.name === 'string' && typeof m.value === 'string')
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

type ExtractedStatus = 'ok' | 'atencao' | 'alterado' | 'indeterminado';

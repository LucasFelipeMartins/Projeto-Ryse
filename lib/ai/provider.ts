import 'server-only';
import OpenAI from 'openai';

/**
 * Provedor de IA da plataforma.
 *
 * A análise de documento já usava a OpenAI. O restante da inteligência —
 * relatórios, dieta, ficha, protocolo — roda por aqui, e o padrão é um
 * provedor **gratuito**.
 *
 * O truque é que praticamente todo provedor sério hoje expõe a mesma API da
 * OpenAI. Trocando só a `baseURL`, o mesmo SDK fala com Groq, OpenRouter,
 * Gemini ou um Ollama local. Então não há adaptador por provedor: há uma
 * configuração.
 *
 * Ordem de resolução:
 *   1. AI_API_KEY + AI_BASE_URL  — o que o operador escolheu
 *   2. GROQ_API_KEY              — gratuito, sem cartão
 *   3. OPENROUTER_API_KEY        — catálogo com modelos `:free`
 *   4. OPENAI_API_KEY            — pago, já configurado para documentos
 *
 * Sem nenhuma chave, `aiProvider()` devolve `null` e a interface mostra um
 * aviso claro em vez de um botão que não faz nada.
 */

export type AiProvider = {
  name: string;
  model: string;
  client: OpenAI;
  /** `true` quando o provedor em uso é de custo zero. */
  free: boolean;
};

type Candidate = {
  name: string;
  free: boolean;
  key: string | undefined;
  baseURL: string;
  model: string;
};

/** Modelos gratuitos que aguentam texto longo e devolvem JSON confiável. */
const GROQ_MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL ?? 'meta-llama/llama-3.3-70b-instruct:free';

function candidates(): Candidate[] {
  return [
    {
      name: process.env.AI_PROVIDER_NAME ?? 'personalizado',
      free: process.env.AI_PROVIDER_FREE !== 'false',
      key: process.env.AI_API_KEY,
      baseURL: process.env.AI_BASE_URL ?? 'https://api.groq.com/openai/v1',
      model: process.env.AI_MODEL ?? GROQ_MODEL,
    },
    {
      name: 'groq',
      free: true,
      key: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
      model: GROQ_MODEL,
    },
    {
      name: 'openrouter',
      free: true,
      key: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      model: OPENROUTER_MODEL,
    },
    {
      name: 'openai',
      free: false,
      key: process.env.OPENAI_API_KEY,
      baseURL: 'https://api.openai.com/v1',
      model: process.env.OPENAI_ANALYSIS_MODEL ?? 'gpt-4o-mini',
    },
  ];
}

export function aiProvider(): AiProvider | null {
  const chosen = candidates().find((c) => Boolean(c.key));
  if (!chosen) return null;

  return {
    name: chosen.name,
    model: chosen.model,
    free: chosen.free,
    client: new OpenAI({
      apiKey: chosen.key,
      baseURL: chosen.baseURL,
      // Relatório longo com histórico pode passar de 30 s.
      timeout: 90_000,
      maxRetries: 1,
    }),
  };
}

/** `true` quando existe algum provedor configurado. */
export const isAiConfigured = () => candidates().some((c) => Boolean(c.key));

export class AiUnavailableError extends Error {
  constructor() {
    super('Nenhum provedor de IA configurado.');
    this.name = 'AiUnavailableError';
  }
}

/**
 * Uma pergunta, uma resposta em JSON.
 *
 * `response_format: json_object` é suportado por Groq, OpenRouter e OpenAI.
 * Ainda assim o parse é defensivo: modelo aberto às vezes embrulha o JSON em
 * cerca de markdown, e derrubar o relatório por causa de três crases seria
 * um desperdício.
 */
export async function askJson<T>(input: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<{ data: T; model: string }> {
  const provider = aiProvider();
  if (!provider) throw new AiUnavailableError();

  const response = await provider.client.chat.completions.create({
    model: provider.model,
    response_format: { type: 'json_object' },
    temperature: input.temperature ?? 0.3,
    max_tokens: input.maxTokens ?? 4096,
    messages: [
      { role: 'system', content: input.system },
      { role: 'user', content: input.user },
    ],
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('A IA não devolveu conteúdo.');

  return { data: parseLooseJson<T>(raw), model: provider.model };
}

/** Extrai o JSON mesmo quando vem cercado por texto ou markdown. */
export function parseLooseJson<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Último recurso: pega do primeiro `{` ao último `}`.
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end <= start) {
      throw new Error('A IA devolveu uma resposta fora do formato esperado.');
    }
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  }
}

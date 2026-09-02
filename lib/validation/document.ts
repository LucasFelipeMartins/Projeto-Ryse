/**
 * Validação de documentos de saúde.
 *
 * Roda nas duas pontas com as mesmas regras: no cliente para dar retorno
 * imediato, no servidor porque a checagem do cliente pode ser burlada.
 *
 * O servidor não confia no `type` que o navegador declara — ele lê os
 * primeiros bytes do arquivo. Renomear `foto.jpg` para `exame.pdf` engana a
 * extensão, mas não a assinatura binária.
 */

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_PDF_PAGES = 30;
/**
 * Janela semanal (segunda a domingo), não diária: exame é evento esparso —
 * quem coleta sangue não repete no dia seguinte.
 */
export const MAX_UPLOADS_PER_WEEK = 3;

export type AllowedMime = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';

export const ALLOWED_MIMES: AllowedMime[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

/** Aceito pelo seletor de arquivos do navegador. */
export const ACCEPT_ATTRIBUTE = '.pdf,.jpg,.jpeg,.png,.webp';

export type ValidationError = {
  code:
    | 'tipo_nao_permitido'
    | 'arquivo_vazio'
    | 'arquivo_grande'
    | 'assinatura_invalida'
    | 'pdf_protegido'
    | 'pdf_longo'
    | 'limite_semanal';
  message: string;
};

export type ValidationOk = { mime: AllowedMime; pages: number | null };

export type ValidationResult =
  | ({ ok: true } & ValidationOk)
  | { ok: false; error: ValidationError };

const fail = (code: ValidationError['code'], message: string): ValidationResult => ({
  ok: false,
  error: { code, message },
});

export const humanSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/* ------------------------------------------------------- ASSINATURAS ---- */

/**
 * Primeiros bytes de cada formato aceito.
 * `offset` existe porque o WebP identifica-se em duas partes ("RIFF" + "WEBP").
 */
const SIGNATURES: {
  mime: AllowedMime;
  parts: { offset: number; bytes: number[] }[];
}[] = [
  // %PDF-
  { mime: 'application/pdf', parts: [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }] },
  { mime: 'image/jpeg', parts: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }] },
  {
    mime: 'image/png',
    parts: [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  },
  {
    mime: 'image/webp',
    parts: [
      { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF
      { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }, // WEBP
    ],
  },
];

/** Descobre o tipo real a partir dos bytes. `null` se não for reconhecido. */
export function sniffMime(bytes: Uint8Array): AllowedMime | null {
  for (const sig of SIGNATURES) {
    const matches = sig.parts.every((part) =>
      part.bytes.every((b, i) => bytes[part.offset + i] === b),
    );
    if (matches) return sig.mime;
  }
  return null;
}

/* --------------------------------------------------------------- PDF ---- */

const decoder = new TextDecoder('latin1');

/**
 * PDF com senha ou permissões: o dicionário do trailer traz `/Encrypt`.
 * A API não consegue ler o conteúdo, então recusar aqui evita uma chamada
 * cara que falharia de qualquer jeito.
 */
function isEncryptedPdf(bytes: Uint8Array): boolean {
  // O trailer fica no fim do arquivo; 4 KB cobrem com folga.
  const tail = decoder.decode(bytes.subarray(Math.max(0, bytes.length - 4096)));
  return /\/Encrypt[\s\d<]/.test(tail);
}

/**
 * Contagem aproximada de páginas.
 *
 * Conta as ocorrências de `/Type /Page` (sem o "s" de `/Pages`). É uma
 * heurística: serve para barrar um calhamaço de 500 páginas, não para exibir
 * o número ao usuário.
 */
function countPdfPages(bytes: Uint8Array): number {
  const text = decoder.decode(bytes);
  const matches = text.match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 1;
}

/* ------------------------------------------------------------ CLIENTE --- */

/** Checagem rápida, antes de gastar banda com o upload. */
export function validateBeforeUpload(file: File): ValidationResult {
  if (file.size === 0) {
    return fail('arquivo_vazio', 'O arquivo está vazio.');
  }
  if (file.size > MAX_FILE_BYTES) {
    return fail(
      'arquivo_grande',
      `O arquivo tem ${humanSize(file.size)}. O limite é ${humanSize(MAX_FILE_BYTES)}.`,
    );
  }
  if (!ALLOWED_MIMES.includes(file.type as AllowedMime)) {
    return fail(
      'tipo_nao_permitido',
      'Envie um PDF ou uma foto do exame (JPG, PNG ou WebP).',
    );
  }
  return { ok: true, mime: file.type as AllowedMime, pages: null };
}

/* ------------------------------------------------------------ SERVIDOR -- */

/** Checagem autoritativa: lê os bytes e ignora o que o cliente declarou. */
export function validateBytes(bytes: Uint8Array, declaredMime: string): ValidationResult {
  if (bytes.length === 0) {
    return fail('arquivo_vazio', 'O arquivo está vazio.');
  }
  if (bytes.length > MAX_FILE_BYTES) {
    return fail(
      'arquivo_grande',
      `O arquivo tem ${humanSize(bytes.length)}. O limite é ${humanSize(MAX_FILE_BYTES)}.`,
    );
  }

  const real = sniffMime(bytes);

  if (!real) {
    return fail(
      'assinatura_invalida',
      'Não reconhecemos esse arquivo como PDF ou imagem. Reenvie o exame original.',
    );
  }

  // Extensão trocada: o conteúdo não é o que o nome promete.
  if (declaredMime && declaredMime !== real) {
    return fail(
      'assinatura_invalida',
      `O arquivo foi enviado como ${declaredMime}, mas o conteúdo é ${real}. Reenvie o original.`,
    );
  }

  if (real === 'application/pdf') {
    if (isEncryptedPdf(bytes)) {
      return fail(
        'pdf_protegido',
        'Esse PDF está protegido por senha. Salve uma cópia sem proteção e reenvie.',
      );
    }

    const pages = countPdfPages(bytes);
    if (pages > MAX_PDF_PAGES) {
      return fail(
        'pdf_longo',
        `O PDF tem cerca de ${pages} páginas. Envie apenas o laudo (até ${MAX_PDF_PAGES} páginas).`,
      );
    }

    return { ok: true, mime: real, pages };
  }

  return { ok: true, mime: real, pages: null };
}

/**
 * Tipos compartilhados entre servidor e cliente.
 *
 * Fica separado de `lib/queries/*` porque aqueles arquivos são `server-only`
 * e não podem ser importados por componentes de cliente.
 */

/** Intenção visual de um estado — usada por Badge, Stat e afins. */
export type Tone = 'neutral' | 'brand' | 'success' | 'danger' | 'warn';

/** Retorno padrão das Server Actions. */
export type ActionResult = { ok: boolean; error?: string };

/**
 * Teto de um único registro de hidratação, em ml.
 * Espelha o CHECK de `hydration_logs.amount_ml` na migration.
 */
export const MAX_INTAKE_ML = 5000;

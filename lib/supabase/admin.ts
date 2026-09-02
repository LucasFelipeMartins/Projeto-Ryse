import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

/**
 * Cliente administrativo — ignora a RLS.
 *
 * Existe por um motivo só: o despacho de notificações precisa varrer a fila
 * de **todos** os usuários, e não há sessão de usuário numa execução de cron.
 * Nenhuma outra parte do app deve importar este módulo; toda leitura feita em
 * nome de alguém passa por `lib/supabase/server.ts`, sob RLS.
 *
 * A chave secreta nunca leva o prefixo NEXT_PUBLIC_ — se levasse, iria para o
 * bundle do navegador e daria acesso irrestrito ao banco a qualquer visitante.
 */

export const isAdminConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
  );

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Cliente administrativo indisponível: defina SUPABASE_SECRET_KEY no servidor.',
    );
  }

  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

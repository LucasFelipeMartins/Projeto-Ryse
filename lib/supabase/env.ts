/**
 * Leitura das variáveis do Supabase com erro legível.
 *
 * As variáveis são lidas por referência literal (`process.env.NOME`) porque o
 * Next substitui isso em tempo de build; acesso dinâmico não funcionaria no
 * bundle do navegador.
 *
 * Duas gerações de chave pública são aceitas:
 *   - `sb_publishable_…` (atual)  -> NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 *   - JWT `anon` (legado)         -> NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * Ambas são chaves de cliente: vão no bundle do navegador e não protegem
 * nada sozinhas. Quem protege é a RLS. A chave secreta (`service_role` /
 * `sb_secret_…`) nunca deve aparecer neste projeto.
 */

const publicKey = () =>
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = publicKey();

  if (!url || !anonKey) {
    throw new Error(
      'Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e ' +
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (veja .env.example).',
    );
  }

  return { url, anonKey };
}

/** `true` quando dá para falar com o Supabase — usado para telas de aviso. */
export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && publicKey());

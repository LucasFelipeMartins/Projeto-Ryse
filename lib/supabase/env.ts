/**
 * Leitura das variáveis do Supabase com erro legível.
 *
 * As variáveis são lidas por referência literal (`process.env.NOME`) porque o
 * Next substitui isso em tempo de build; acesso dinâmico não funcionaria no
 * bundle do navegador.
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY (veja .env.example).',
    );
  }

  return { url, anonKey };
}

/** `true` quando dá para falar com o Supabase — usado para telas de aviso. */
export const isSupabaseConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

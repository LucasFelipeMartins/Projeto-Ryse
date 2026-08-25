'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/supabase/types';
import { supabaseEnv } from '@/lib/supabase/env';

/** Cliente Supabase do navegador. Usa apenas a chave anônima + RLS. */
export function createClient() {
  const { url, anonKey } = supabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}

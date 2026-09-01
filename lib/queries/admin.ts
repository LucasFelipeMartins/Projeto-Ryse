import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * Leituras da área administrativa.
 *
 * Vão pelo cliente normal, sob RLS: a política "administrador lê todos os
 * perfis" (migration 006) é que libera a visão ampla. Usar a chave secreta
 * aqui funcionaria, mas dispensaria a verificação — e uma falha na checagem
 * de papel viraria vazamento de base inteira em vez de uma tela vazia.
 */

export type ProfissionalAdminView = {
  id: string;
  fullName: string;
  email: string;
  specialty: string | null;
  crm: string | null;
  avatarUrl: string | null;
  /** `true` enquanto a senha provisória não foi trocada. */
  pendingFirstAccess: boolean;
  patientCount: number;
  createdAt: string;
};

export async function listarProfissionais(): Promise<ProfissionalAdminView[]> {
  const supabase = await createClient();

  const { data: profissionais } = await supabase
    .from('profiles')
    .select(
      'id, full_name, email, specialty, crm, avatar_url, must_change_password, created_at',
    )
    .eq('role', 'profissional')
    .order('full_name');

  if (!profissionais?.length) return [];

  // Contagem de pacientes por profissional numa consulta só.
  const { data: pacientes } = await supabase
    .from('profiles')
    .select('professional_id')
    .eq('role', 'paciente')
    .not('professional_id', 'is', null);

  const porProfissional = new Map<string, number>();
  for (const p of pacientes ?? []) {
    if (!p.professional_id) continue;
    porProfissional.set(
      p.professional_id,
      (porProfissional.get(p.professional_id) ?? 0) + 1,
    );
  }

  return profissionais.map((p) => ({
    id: p.id,
    fullName: p.full_name,
    email: p.email,
    specialty: p.specialty,
    crm: p.crm,
    avatarUrl: p.avatar_url,
    pendingFirstAccess: p.must_change_password ?? false,
    patientCount: porProfissional.get(p.id) ?? 0,
    createdAt: p.created_at,
  }));
}

export type ResumoAdmin = {
  profissionais: number;
  pacientes: number;
  pacientesSemProfissional: number;
  primeirosAcessosPendentes: number;
};

export async function getResumoAdmin(): Promise<ResumoAdmin> {
  const supabase = await createClient();

  const [pros, pacientes, semPro, pendentes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'profissional'),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'paciente'),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'paciente')
      .is('professional_id', null),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'profissional')
      .eq('must_change_password', true),
  ]);

  return {
    profissionais: pros.count ?? 0,
    pacientes: pacientes.count ?? 0,
    pacientesSemProfissional: semPro.count ?? 0,
    primeirosAcessosPendentes: pendentes.count ?? 0,
  };
}

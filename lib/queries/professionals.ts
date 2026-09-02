import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type ProfessionalOption = {
  id: string;
  name: string;
  specialty: string | null;
  crm: string | null;
  patientCount: number;
  /** Estimativa de tempo de resposta derivada da carga. */
  responsiveness: 'alta' | 'media' | 'baixa';
};

/**
 * Menos pacientes por profissional significa mais atenção por caso — daí a
 * faixa. Os cortes são deliberadamente conservadores: com uma base pequena,
 * quase todo mundo cai em "alta", que é o esperado no começo.
 */
function responsivenessFor(count: number): ProfessionalOption['responsiveness'] {
  if (count <= 15) return 'alta';
  if (count <= 40) return 'media';
  return 'baixa';
}

/**
 * Diretório de profissionais, já ordenado do menos carregado para o mais.
 *
 * A consulta passa pela função `list_professionals()` porque a RLS de
 * `profiles` — corretamente — não deixa um paciente ler o perfil de
 * profissionais aos quais não está vinculado. A função devolve só o que é
 * público: nome, especialidade, CRM e a contagem de pacientes.
 */
export async function listProfessionals(): Promise<ProfessionalOption[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('list_professionals');

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.full_name,
    specialty: p.specialty,
    crm: p.crm,
    patientCount: p.patient_count,
    responsiveness: responsivenessFor(p.patient_count),
  }));
}

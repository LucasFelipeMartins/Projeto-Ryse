-- =============================================================================
-- RYSE — ESCOLHA DO PROFISSIONAL
-- =============================================================================
-- Antes, o vínculo paciente↔profissional só existia via SQL manual. Agora o
-- próprio paciente escolhe a partir de um diretório — ou decide seguir sem
-- profissional, contando apenas com a análise da IA.
-- =============================================================================

-- Quando o paciente decidiu seguir sozinho. Serve para o app parar de sugerir
-- a escolha; é diferente de `professional_id is null`, que também acontece em
-- quem simplesmente ainda não escolheu.
alter table profiles
  add column if not exists chose_solo_at timestamptz;

comment on column profiles.chose_solo_at is
  'Marca a decisão consciente de seguir sem profissional. NULL + professional_id NULL = ainda não escolheu.';

-- ------------------------------------------- INTEGRIDADE DO VÍNCULO -------

/*
  A política de RLS deixa o paciente editar o próprio perfil — inclusive
  `professional_id`. Sem esta trava, ele poderia apontar para outro paciente
  e, com isso, ganhar acesso de leitura aos dados dele (`is_my_patient`
  percorre exatamente essa aresta).

  O gatilho garante que o alvo é mesmo um profissional, e que ninguém se
  vincula a si mesmo.
*/
create or replace function validate_professional_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.professional_id is null then
    return new;
  end if;

  if new.professional_id = new.id then
    raise exception 'Um perfil não pode ser o próprio profissional.';
  end if;

  if not exists (
    select 1 from profiles
     where id = new.professional_id and role = 'profissional'
  ) then
    raise exception 'O profissional selecionado não existe.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_validate_link on profiles;
create trigger profiles_validate_link
  before insert or update of professional_id on profiles
  for each row execute function validate_professional_link();

-- -------------------------------------------------------- DIRETÓRIO -------

/*
  Lista de profissionais disponíveis, com a contagem de pacientes.

  SECURITY DEFINER de propósito: a RLS de `profiles` não deixa um paciente
  ler o perfil de profissionais aos quais não está vinculado, e não queremos
  afrouxar aquela política. Esta função devolve apenas o que é público de um
  profissional — nome, especialidade, CRM e quantos pacientes atende. Nada de
  e-mail, telefone ou dado clínico.
*/
create or replace function list_professionals()
returns table (
  id            uuid,
  full_name     text,
  specialty     text,
  crm           text,
  patient_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.full_name,
    p.specialty,
    p.crm,
    (
      select count(*)::integer
        from profiles c
       where c.professional_id = p.id and c.role = 'paciente'
    ) as patient_count
  from profiles p
  where p.role = 'profissional'
  order by patient_count asc, p.full_name asc;
$$;

-- Só quem está autenticado enxerga o diretório.
revoke execute on function list_professionals() from anon;
grant execute on function list_professionals() to authenticated;

-- --------------------------------------------------------- PROTOCOLOS ----

/*
  `protocols.body` guarda o conteúdo do molde em jsonb. Até agora nada
  escrevia nele; com a criação pelo profissional, vale registrar o formato
  esperado para que a IA saiba ler:

    {
      "description": "texto livre",
      "items": ["linha 1", "linha 2"]
    }
*/
comment on column protocols.body is
  'Conteúdo do molde: { "description": string, "items": string[] }.';

-- Impede protocolo sem título depois de um trim.
alter table protocols
  drop constraint if exists protocols_title_not_blank;

alter table protocols
  add constraint protocols_title_not_blank check (length(btrim(title)) >= 3);

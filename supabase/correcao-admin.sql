-- =============================================================================
-- RYSE — CORREÇÃO: colunas de administração e senha provisória
-- =============================================================================
-- Rode este arquivo se `npm run doctor` acusar as colunas `is_admin` ou
-- `must_change_password` faltando em `profiles`.
--
-- É o mesmo caso da `correcao-perfil.sql`: na migration 006 as funções e
-- políticas entraram, mas os `alter table` não. Enquanto essas duas colunas
-- não existirem, o LOGIN NÃO FUNCIONA — a consulta de perfil pede colunas
-- inexistentes e o app conclui que a conta não tem perfil.
--
-- Seguro rodar quantas vezes quiser.
--
-- Conferir antes e depois:  npm run doctor
-- =============================================================================

-- ------------------------------------------------------------- COLUNAS -----

/*
  Um ALTER por coluna.

  Agrupá-las é o que produziu este arquivo: quando as duas vão no mesmo
  comando, uma falha derruba a outra, e o banco fica no pior estado possível
  — parece que a migration rodou, porque tudo o que vem depois entrou.
*/
alter table profiles add column if not exists is_admin boolean not null default false;
alter table profiles add column if not exists must_change_password boolean not null default false;

comment on column profiles.is_admin is
  'Acesso a /admin. Só definível pela chave secreta — ver guard_privileged_profile_columns.';

comment on column profiles.must_change_password is
  'Senha provisória em uso. Enquanto verdadeiro, o app só permite /definir-senha.';

create index if not exists profiles_admin_idx on profiles(id) where is_admin;

-- ------------------------------------------------- TRAVA DE PRIVILÉGIO -----

/*
  Recriada aqui porque o corpo da função referencia as colunas acima.

  O plpgsql só resolve os campos de `new` em tempo de execução, então o
  gatilho pode ter sido criado antes das colunas existirem — e, nesse estado,
  qualquer UPDATE em `profiles` feito por um usuário logado estouraria com
  "record new has no field is_admin". Recriar depois das colunas fecha essa
  janela.

  A função existe para tapar um buraco real: a política "perfil próprio é
  editável" libera a linha inteira, sem distinguir colunas, então sem esta
  trava qualquer paciente poderia rodar
  `update profiles set role = 'profissional'` e entrar na área clínica.
*/
create or replace function guard_privileged_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  privilegiado boolean;
begin
  -- Chave secreta: nenhum JWT de usuário na requisição.
  if auth.uid() is null then
    return new;
  end if;

  -- Marca deixada por uma função SECURITY DEFINER nossa.
  privilegiado := coalesce(current_setting('ryse.privileged', true) = 'on', false);
  if privilegiado then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'O papel da conta não pode ser alterado por aqui.'
      using errcode = '42501';
  end if;

  if new.is_admin is distinct from old.is_admin then
    raise exception 'A permissão de administrador não pode ser alterada por aqui.'
      using errcode = '42501';
  end if;

  if new.must_change_password is distinct from old.must_change_password then
    raise exception 'A troca de senha obrigatória não pode ser alterada por aqui.'
      using errcode = '42501';
  end if;

  -- CRM é registro profissional, não preferência: quem preenche é a
  -- administração, ao cadastrar.
  if new.crm is distinct from old.crm then
    raise exception 'O registro profissional é definido pela administração.'
      using errcode = '42501';
  end if;

  return new;
end;
$fn$;

drop trigger if exists profiles_guard_privileged on profiles;
create trigger profiles_guard_privileged
  before update on profiles
  for each row execute function guard_privileged_profile_columns();

-- --------------------------------------------- FIM DA SENHA PROVISÓRIA -----

/*
  Único caminho para desligar `must_change_password`.

  SECURITY DEFINER porque a coluna é protegida pelo gatilho acima — e precisa
  ser: se um update comum a desligasse, bastaria isso para seguir usando a
  senha que circulou por mensagem.
*/
create or replace function finish_password_setup()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null then
    raise exception 'Sessão ausente.' using errcode = '42501';
  end if;

  -- `true` = vale só nesta transação; o gatilho lê a marca e libera a coluna.
  perform set_config('ryse.privileged', 'on', true);

  update profiles
     set must_change_password = false
   where id = auth.uid();
end;
$fn$;

revoke execute on function finish_password_setup() from anon;
grant execute on function finish_password_setup() to authenticated;

-- ------------------------------------------------- LEITURA PARA O ADMIN ----

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce((select p.is_admin from profiles p where p.id = auth.uid()), false);
$fn$;

revoke execute on function is_admin() from anon;
grant execute on function is_admin() to authenticated;

drop policy if exists "administrador lê todos os perfis" on profiles;
create policy "administrador lê todos os perfis"
  on profiles for select
  using (is_admin());

-- ------------------------------------------------------------ CONFERÊNCIA --

/*
  Se as duas linhas vierem com `existe = true`, o login volta a funcionar.
  Depois disso, conceda a si mesmo o acesso administrativo:

      node scripts/admin.mjs admin seu@email.com
*/
select
  coluna,
  exists (
    select 1
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name = 'profiles'
       and c.column_name = coluna
  ) as existe
from unnest(array['is_admin', 'must_change_password']) as coluna;

-- =============================================================================
-- RYSE — ADMINISTRAÇÃO E CONTROLE DE ACESSO
-- =============================================================================
--   1. trava de colunas privilegiadas (corrige escalação de privilégio)
--   2. papel de administrador
--   3. senha provisória e troca obrigatória no primeiro acesso
-- =============================================================================

-- ================================================ COLUNAS PRIVILEGIADAS ====

/*
  ATENÇÃO — esta seção corrige uma falha de segurança que já existia.

  A política "perfil próprio é editável" permite que cada um altere a própria
  linha em `profiles`:

      using (id = auth.uid()) with check (id = auth.uid())

  Ela não distingue QUAIS colunas, então qualquer paciente autenticado podia
  executar, direto pela chave publicável:

      update profiles set role = 'profissional' where id = <o próprio id>

  e passar a enxergar a área clínica. Com a chegada de `is_admin`, o mesmo
  caminho daria acesso à criação de profissionais — ou seja, ao sistema
  inteiro.

  Restringir a política por coluna não é possível no Postgres (RLS opera na
  linha). A trava correta é um gatilho: ele deixa a atualização passar, mas
  recusa quando uma coluna privilegiada muda de valor.

  Duas exceções, ambas deliberadas:

    - `auth.uid() is null` -> não há JWT de usuário, então quem escreve é a
      chave secreta (scripts administrativos, Server Actions de admin);
    - `ryse.privileged` ligado na transação -> uma função SECURITY DEFINER
      nossa autorizou aquela mudança específica.
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
  privilegiado := coalesce(
    current_setting('ryse.privileged', true) = 'on',
    false
  );

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

  /*
    CRM é registro profissional, não preferência. Deixar cada um declarar o
    próprio número significaria exibir ao paciente uma credencial que ninguém
    verificou. Quem preenche é a administração, ao cadastrar.
  */
  if new.crm is distinct from old.crm then
    raise exception 'O registro profissional é definido pela administração.'
      using errcode = '42501';
  end if;

  return new;
end;
$fn$;

-- ==================================================== PAPEL DE ADMIN =======

/*
  Administrador é uma marca sobre a conta, não um terceiro papel.

  Criar `role = 'admin'` obrigaria a revisar cada `requirePatient()` e
  `requireProfessional()` do app, e deixaria a conta sem área própria. Uma
  flag mantém o modelo de papéis intacto: o admin continua sendo paciente ou
  profissional no dia a dia, e ganha acesso a /admin por cima disso.
*/
alter table profiles add column if not exists is_admin boolean not null default false;

comment on column profiles.is_admin is
  'Acesso a /admin. Só é definível pela chave secreta — ver guard_privileged_profile_columns.';

create index if not exists profiles_admin_idx on profiles(id) where is_admin;

-- ======================================== SENHA PROVISÓRIA / 1º ACESSO =====

/*
  Conta criada pela administração nasce com senha provisória.

  A senha é entregue por fora (mensagem, papel, o que for) e serve uma vez:
  no primeiro acesso o app exige a troca antes de liberar qualquer tela. Sem
  isso, a senha que circulou pelo WhatsApp continuaria válida para sempre.
*/
alter table profiles add column if not exists must_change_password boolean not null default false;

comment on column profiles.must_change_password is
  'Senha provisória em uso. Enquanto verdadeiro, o app só permite /definir-senha.';

/*
  Encerra a exigência de troca.

  SECURITY DEFINER porque `must_change_password` é coluna protegida pelo
  gatilho acima — e tem de ser: se o próprio usuário pudesse desligá-la com um
  update comum, bastaria isso para continuar usando a senha provisória.

  A função só age sobre a própria linha, e só depois de a senha ter sido de
  fato trocada (quem chama é a Server Action, logo após `updateUser`).
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

-- O gatilho entra depois das colunas existirem — ele referencia as três.
drop trigger if exists profiles_guard_privileged on profiles;
create trigger profiles_guard_privileged
  before update on profiles
  for each row execute function guard_privileged_profile_columns();

comment on function guard_privileged_profile_columns is
  'Impede escalação de privilégio via update no próprio perfil (role, is_admin, crm).';

-- ================================================ LEITURA PARA O ADMIN =====

/*
  O administrador precisa enxergar todos os perfis para gerir a equipe. A RLS
  de `profiles` não permitiria: ela só libera o próprio perfil, os pacientes
  do profissional e o profissional do paciente.

  A checagem passa por uma função SECURITY DEFINER porque consultar `profiles`
  dentro de uma política de `profiles` dispararia a própria política, em
  recursão infinita — mesmo motivo de `is_my_patient`.
*/
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(
    (select p.is_admin from profiles p where p.id = auth.uid()),
    false
  );
$fn$;

revoke execute on function is_admin() from anon;
grant execute on function is_admin() to authenticated;

drop policy if exists "administrador lê todos os perfis" on profiles;
create policy "administrador lê todos os perfis"
  on profiles for select
  using (is_admin());

/*
  O admin NÃO ganha política de UPDATE nem de INSERT aqui.

  Criar conta exige a API de autenticação (não dá para inserir em
  `auth.users` por SQL), então o cadastro de profissional passa por uma
  Server Action com a chave secreta — que já ignora a RLS. Abrir escrita
  ampla na tabela seria superfície extra sem ganho nenhum.
*/

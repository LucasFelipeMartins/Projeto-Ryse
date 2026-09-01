-- =============================================================================
-- RYSE — CORREÇÃO: colunas de `profiles` e bucket de avatares
-- =============================================================================
-- Rode este arquivo se o login estiver caindo em "perfil ausente" ou na tela
-- "o banco está desatualizado".
--
-- Ele reaplica APENAS os dois trechos da migration 005 que costumam não pegar
-- quando o arquivo grande é executado em pedaços no SQL Editor: as colunas
-- novas de `profiles` e o bucket `avatares`. As tabelas e funções da 005 ficam
-- intocadas — se já existem, este arquivo não encosta nelas.
--
-- É seguro rodar quantas vezes quiser: tudo aqui é `if not exists` ou upsert.
--
-- Para conferir antes e depois:  npm run doctor
-- =============================================================================

-- ------------------------------------------------ COLUNAS DO ONBOARDING ----

/*
  Cada coluna vai no seu próprio ALTER, de propósito.

  Agrupar as nove num único comando é mais bonito, mas transforma o bloco em
  tudo-ou-nada: um detalhe em qualquer cláusula derruba as outras oito junto,
  e o resultado é exatamente o estado pela metade que motivou este arquivo.
  Separadas, uma falha isolada não leva as demais.
*/

alter table profiles add column if not exists sex text;
alter table profiles add column if not exists activity_level text;
alter table profiles add column if not exists training_level text;
alter table profiles add column if not exists training_days integer;
alter table profiles add column if not exists routine text;
alter table profiles add column if not exists food_preferences text[] not null default '{}';
alter table profiles add column if not exists food_restrictions text[] not null default '{}';
alter table profiles add column if not exists health_notes text;
alter table profiles add column if not exists timezone text not null default 'America/Sao_Paulo';
alter table profiles add column if not exists water_goal_override_ml integer;

-- ------------------------------------------------------------ RESTRIÇÕES ---

/*
  As restrições vêm depois das colunas, e não como CHECK inline.

  Assim uma linha pré-existente com valor fora da faixa não impede a coluna de
  nascer — o erro fica restrito ao ADD CONSTRAINT, que é onde ele deve estar.
  `drop ... if exists` antes de cada uma torna o arquivo repetível.
*/

alter table profiles drop constraint if exists profiles_sex_check;
alter table profiles add constraint profiles_sex_check
  check (sex is null or sex in ('feminino', 'masculino', 'outro'));

alter table profiles drop constraint if exists profiles_activity_level_check;
alter table profiles add constraint profiles_activity_level_check
  check (
    activity_level is null
    or activity_level in ('sedentario', 'leve', 'moderado', 'intenso', 'atleta')
  );

alter table profiles drop constraint if exists profiles_training_level_check;
alter table profiles add constraint profiles_training_level_check
  check (
    training_level is null
    or training_level in ('iniciante', 'intermediario', 'avancado')
  );

alter table profiles drop constraint if exists profiles_training_days_check;
alter table profiles add constraint profiles_training_days_check
  check (training_days is null or training_days between 0 and 7);

alter table profiles drop constraint if exists profiles_water_goal_override_ml_check;
alter table profiles add constraint profiles_water_goal_override_ml_check
  check (
    water_goal_override_ml is null
    or water_goal_override_ml between 500 and 10000
  );

comment on column profiles.water_goal_override_ml is
  'Meta manual de água. NULL = usar o cálculo automático a partir do peso mais recente.';

comment on column profiles.onboarded_at is
  'Marca o fim do formulário inicial. NULL = o app redireciona para /onboarding.';

-- --------------------------------------------------- BUCKET DE AVATARES ----

/*
  Público de propósito: o avatar aparece no menu, no cabeçalho e na lista de
  pacientes — emitir signed URL a cada render custaria uma ida ao Storage por
  imagem, e não há dado clínico numa foto de perfil.

  A escrita continua fechada: só o dono grava na própria pasta.
*/
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatares',
  'avatares',
  true,
  2097152, -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = true,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatar: leitura pública" on storage.objects;
create policy "avatar: leitura pública"
  on storage.objects for select
  using (bucket_id = 'avatares');

drop policy if exists "avatar: dono envia" on storage.objects;
create policy "avatar: dono envia"
  on storage.objects for insert
  with check (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatar: dono atualiza" on storage.objects;
create policy "avatar: dono atualiza"
  on storage.objects for update
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatar: dono apaga" on storage.objects;
create policy "avatar: dono apaga"
  on storage.objects for delete
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------------------ CONFERÊNCIA --

/*
  Devolve uma linha por coluna esperada, dizendo se ela chegou. Se todas
  vierem como `true`, o login volta a funcionar sem mais nada.
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
from unnest(array[
  'sex', 'activity_level', 'training_level', 'training_days', 'routine',
  'food_preferences', 'food_restrictions', 'health_notes', 'timezone',
  'water_goal_override_ml', 'onboarded_at'
]) as coluna;

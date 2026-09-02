-- =============================================================================
-- RYSE — DOCUMENTOS DE SAÚDE
-- =============================================================================
-- O paciente envia exames (PDF ou foto) para avaliação. O arquivo vai para o
-- Storage; os metadados e o resultado da análise ficam aqui.
--
-- O documento passa por quatro camadas antes de virar dado clínico:
--   1. cliente   — tipo e tamanho
--   2. servidor  — assinatura binária, PDF protegido, número de páginas
--   3. conteúdo  — o texto tem cara de exame?
--   4. IA        — classificação e extração (provedor plugável)
-- =============================================================================

create type document_status as enum (
  'validando',          -- upload recebido, checagens em curso
  'rejeitado',          -- reprovado em alguma camada
  'aguardando_analise', -- passou nas checagens; sem provedor de IA configurado
  'analisado',          -- extraído e pronto para revisão do profissional
  'erro'                -- falha técnica na análise
);

create type document_kind as enum (
  'exame_laboratorial',
  'laudo_imagem',
  'receita',
  'atestado',
  'outro_saude',
  'nao_relacionado'
);

create table health_documents (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references profiles(id) on delete cascade,

  -- Arquivo
  storage_path  text not null unique,
  original_name text not null,
  mime_type     text not null,
  size_bytes    integer not null check (size_bytes > 0),
  page_count    integer,

  -- Ciclo de vida
  status        document_status not null default 'validando',
  kind          document_kind,
  reject_reason text,

  -- Resultado da análise
  provider      text,
  summary       text,
  collected_on  date,
  lab           text,
  markers       jsonb not null default '[]'::jsonb,
  highlights    text[] not null default '{}',

  -- Diagnóstico da camada 3, guardado para auditoria da heurística.
  content_score integer,

  -- LGPD: consentimento explícito para enviar a um serviço externo de IA.
  consent_at    timestamptz,

  analyzed_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index health_documents_patient_idx
  on health_documents(patient_id, created_at desc);

create index health_documents_pending_idx
  on health_documents(status) where status = 'aguardando_analise';

comment on table health_documents is
  'Documentos enviados pelo paciente. O arquivo em si mora no bucket "documentos".';

comment on column health_documents.consent_at is
  'Quando o paciente autorizou o envio a um serviço externo de IA. Sem isso, o documento não é analisado.';

-- ------------------------------------------------------------------ RLS ----

alter table health_documents enable row level security;

create policy "leitura: paciente e profissional vinculado"
  on health_documents for select
  using (can_read_patient(patient_id));

create policy "paciente envia o próprio documento"
  on health_documents for insert
  with check (patient_id = auth.uid());

create policy "paciente apaga o próprio documento"
  on health_documents for delete
  using (patient_id = auth.uid());

-- O paciente não atualiza o resultado da análise: quem escreve status, kind
-- e marcadores é a Server Action, e o profissional pode corrigir depois.
create policy "profissional revisa o documento"
  on health_documents for update
  using (is_my_patient(patient_id))
  with check (is_my_patient(patient_id));

-- ------------------------------------------------------------- STORAGE ----

-- Bucket privado: nada de URL pública. O acesso passa por signed URL, que a
-- Server Action só emite depois de checar a RLS.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos',
  'documentos',
  false,
  10485760, -- 10 MB, igual ao limite da aplicação
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public             = false;

/*
  O caminho é sempre `{patient_id}/{uuid}.{ext}`.

  `storage.foldername(name)[1]` devolve a primeira pasta — ou seja, o id do
  dono. Comparar com auth.uid() garante que ninguém escreve nem lê na pasta
  de outro paciente, mesmo forjando o caminho.
*/

create policy "paciente envia na própria pasta"
  on storage.objects for insert
  with check (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "paciente lê a própria pasta"
  on storage.objects for select
  using (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "paciente apaga da própria pasta"
  on storage.objects for delete
  using (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "profissional lê a pasta dos seus pacientes"
  on storage.objects for select
  using (
    bucket_id = 'documentos'
    and is_my_patient(((storage.foldername(name))[1])::uuid)
  );

-- ------------------------------------------------------ LIMITE SEMANAL ----

/*
  Quantos documentos o paciente enviou nesta semana.

  Existe para conter abuso: sem teto, um upload em laço queimaria a cota da
  API de IA. A janela é semanal (segunda a domingo) porque exame é evento
  esparso — quem coleta sangue não repete no dia seguinte.

  SECURITY DEFINER porque a contagem precisa enxergar as linhas antes de a
  política de INSERT ser avaliada.
*/
create or replace function documents_this_week(target_patient uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from health_documents
   where patient_id = target_patient
     and created_at >= date_trunc('week', now());
$$;

-- =============================================================================
-- RYSE — SETUP COMPLETO DO BANCO
-- =============================================================================
-- Arquivo gerado a partir de supabase/migrations/. Cole tudo de uma vez no
-- SQL Editor do Supabase e execute.
--
-- ATENÇÃO: este arquivo é para um banco NOVO. Ele não é idempotente — num
-- banco que já tem as tabelas, o "create type" falha logo no início. Para
-- atualizar um banco existente, rode apenas os arquivos de
-- supabase/migrations/ que ainda não foram aplicados.
--
-- Ordem: schema -> RLS -> funções -> documentos -> escolha do profissional
--        -> plataforma (onboarding, avatar, IA, push, tempo real).
--
-- Depois disso:
--   1. crie duas contas em /cadastrar (profissional e paciente);
--   2. ajuste os e-mails no topo de supabase/seed.sql e rode aquele arquivo.
-- =============================================================================

-- >>>>>>>>>>>>>>>>>>>>>>>>>> 20260101000000_schema.sql <<<<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- RYSE — SCHEMA INICIAL
-- =============================================================================
-- Plataforma de nutrição, treino e exames com revisão clínica humana.
--
-- Princípios adotados aqui:
--   1. Todo dado clínico pertence a um paciente (`patient_id`).
--   2. RLS ligado em TODAS as tabelas — nada é legível por padrão.
--   3. Um profissional só enxerga pacientes vinculados a ele
--      (`profiles.professional_id`).
--   4. Nenhuma política usa `USING (true)`.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------- ENUMS --

create type user_role       as enum ('paciente', 'profissional');
create type plan_tier       as enum ('completo', 'nutricao', 'treino');
create type meal_slot       as enum ('cafe', 'lanche_manha', 'almoco', 'pre_treino', 'pos_treino', 'jantar', 'ceia');
create type protocol_kind   as enum ('nutricao', 'treino', 'exames');
create type review_module   as enum ('nutricao', 'treino', 'suplementacao');
create type review_urgency  as enum ('alta', 'media');
create type review_status   as enum ('pendente', 'aprovado', 'editado', 'rejeitado');
create type marker_status   as enum ('ok', 'atencao', 'alterado');
create type sender_kind     as enum ('paciente', 'profissional', 'ia');
create type payment_status  as enum ('pago', 'pendente', 'falhou', 'estornado');

-- ---------------------------------------------------------------- PROFILES --

create table profiles (
  id               uuid primary key references auth.users on delete cascade,
  email            text not null,
  full_name        text not null,
  role             user_role not null default 'paciente',
  avatar_url       text,
  phone            text,
  birth_date       date,
  height_cm        numeric(5,1),
  goal             text,
  plan             plan_tier,
  -- Profissional responsável por este paciente. Nulo para profissionais.
  professional_id  uuid references profiles(id) on delete set null,
  -- Metas diárias exibidas no painel do paciente.
  water_goal_ml    integer not null default 3000 check (water_goal_ml between 500 and 10000),
  kcal_goal        integer check (kcal_goal between 800 and 8000),
  steps_goal       integer not null default 10000,
  crm              text,
  specialty        text,
  onboarded_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index profiles_professional_idx on profiles(professional_id) where professional_id is not null;
create index profiles_role_idx on profiles(role);

comment on column profiles.professional_id is
  'Profissional responsável. É a aresta que as políticas de RLS percorrem.';

-- ------------------------------------------------------- HELPERS DE ACESSO --

-- SECURITY DEFINER evita recursão infinita: as políticas de `profiles`
-- precisam consultar `profiles`, o que sem isso dispararia a própria política.
create or replace function is_my_patient(patient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = patient and professional_id = auth.uid()
  );
$$;

-- Profissional responsável pelo usuário atual.
create or replace function my_professional_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select professional_id from profiles where id = auth.uid();
$$;

-- Atalho usado em quase toda política de dado clínico.
create or replace function can_read_patient(patient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select patient = auth.uid() or is_my_patient(patient);
$$;

-- ------------------------------------------------------------ MÉTRICAS ----

create table body_metrics (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references profiles(id) on delete cascade,
  measured_on   date not null default current_date,
  weight_kg     numeric(5,2) check (weight_kg between 20 and 400),
  body_fat_pct  numeric(4,1) check (body_fat_pct between 1 and 70),
  lean_mass_kg  numeric(5,2),
  waist_cm      numeric(5,1),
  created_at    timestamptz not null default now(),
  unique (patient_id, measured_on)
);

create index body_metrics_patient_idx on body_metrics(patient_id, measured_on desc);

-- ---------------------------------------------------------- HIDRATAÇÃO ----

-- Cada gole registrado vira uma linha, com o volume exato em ml informado
-- pelo paciente. O total do dia é somado na leitura.
create table hydration_logs (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references profiles(id) on delete cascade,
  logged_on   date not null default current_date,
  amount_ml   integer not null check (amount_ml > 0 and amount_ml <= 5000),
  logged_at   timestamptz not null default now()
);

create index hydration_logs_patient_idx on hydration_logs(patient_id, logged_on desc);

comment on table hydration_logs is
  'Um registro por ingestão, em ml exatos — não há incremento fixo.';

-- ------------------------------------------------------------- NUTRIÇÃO ---

create table nutrition_plans (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references profiles(id) on delete cascade,
  title        text not null,
  kcal_target  integer not null check (kcal_target > 0),
  protein_g    integer not null default 0,
  carb_g       integer not null default 0,
  fat_g        integer not null default 0,
  is_active    boolean not null default true,
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index nutrition_plans_patient_idx on nutrition_plans(patient_id) where is_active;

create table meals (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references nutrition_plans(id) on delete cascade,
  slot        meal_slot not null,
  label       text not null,
  serve_at    time not null,
  title       text not null,
  kcal        integer not null default 0,
  protein_g   integer not null default 0,
  carb_g      integer not null default 0,
  fat_g       integer not null default 0,
  swappable   boolean not null default false,
  position    integer not null default 0
);

create index meals_plan_idx on meals(plan_id, position);

create table meal_items (
  id          uuid primary key default gen_random_uuid(),
  meal_id     uuid not null references meals(id) on delete cascade,
  description text not null,
  position    integer not null default 0
);

create index meal_items_meal_idx on meal_items(meal_id, position);

-- Marcação diária de "comi essa refeição".
create table meal_logs (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references profiles(id) on delete cascade,
  meal_id     uuid not null references meals(id) on delete cascade,
  logged_on   date not null default current_date,
  created_at  timestamptz not null default now(),
  unique (patient_id, meal_id, logged_on)
);

create index meal_logs_patient_idx on meal_logs(patient_id, logged_on desc);

-- --------------------------------------------------------------- TREINO ---

create table workout_plans (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references profiles(id) on delete cascade,
  title       text not null,
  split       text,
  week_number integer not null default 1,
  total_weeks integer not null default 12,
  is_active   boolean not null default true,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index workout_plans_patient_idx on workout_plans(patient_id) where is_active;

create table workouts (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references workout_plans(id) on delete cascade,
  letter       text not null,
  title        text not null,
  focus        text not null,
  est_minutes  integer not null default 45,
  -- 1 = segunda … 7 = domingo. Nulo = ficha sem dia fixo.
  weekday      integer check (weekday between 1 and 7),
  position     integer not null default 0
);

create index workouts_plan_idx on workouts(plan_id, position);

create table exercises (
  id          uuid primary key default gen_random_uuid(),
  workout_id  uuid not null references workouts(id) on delete cascade,
  name        text not null,
  muscle      text not null,
  target_sets integer not null default 3,
  target_reps text not null default '10',
  target_load text,
  rest_text   text,
  note        text,
  position    integer not null default 0
);

create index exercises_workout_idx on exercises(workout_id, position);

create table workout_sessions (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references profiles(id) on delete cascade,
  workout_id       uuid not null references workouts(id) on delete cascade,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  duration_seconds integer,
  rpe              integer check (rpe between 1 and 10),
  notes            text
);

create index workout_sessions_patient_idx on workout_sessions(patient_id, started_at desc);

create table set_logs (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references workout_sessions(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  set_number  integer not null check (set_number > 0),
  load_kg     numeric(6,2),
  reps        integer,
  done        boolean not null default false,
  unique (session_id, exercise_id, set_number)
);

create index set_logs_session_idx on set_logs(session_id);

-- ------------------------------------------------------------- CHECK-IN ---

create table checkins (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references profiles(id) on delete cascade,
  week_start  date not null,
  weight_kg   numeric(5,2),
  sleep_hours numeric(3,1),
  energy      integer check (energy between 1 and 5),
  hunger      integer check (hunger between 1 and 5),
  pain        integer check (pain between 1 and 5),
  adherence   integer check (adherence between 1 and 5),
  notes       text,
  created_at  timestamptz not null default now(),
  unique (patient_id, week_start)
);

create index checkins_patient_idx on checkins(patient_id, week_start desc);

-- --------------------------------------------------------------- EXAMES ---

create table exams (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references profiles(id) on delete cascade,
  collected_on date not null,
  lab          text,
  file_path    text,
  created_at   timestamptz not null default now()
);

create index exams_patient_idx on exams(patient_id, collected_on desc);

create table exam_markers (
  id         uuid primary key default gen_random_uuid(),
  exam_id    uuid not null references exams(id) on delete cascade,
  name       text not null,
  value_text text not null,
  value_num  numeric(10,3),
  unit       text,
  ref_range  text,
  status     marker_status not null default 'ok',
  delta_text text,
  position   integer not null default 0
);

create index exam_markers_exam_idx on exam_markers(exam_id, position);

-- ---------------------------------------------------------- PROTOCOLOS ----

create table protocols (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references profiles(id) on delete cascade,
  title           text not null,
  kind            protocol_kind not null,
  ai_enabled      boolean not null default false,
  uses            integer not null default 0,
  body            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index protocols_professional_idx on protocols(professional_id);

-- --------------------------------------------------------- REVISÃO DA IA --

create table ai_reviews (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references profiles(id) on delete cascade,
  professional_id uuid not null references profiles(id) on delete cascade,
  module          review_module not null,
  urgency         review_urgency not null default 'media',
  confidence      integer not null check (confidence between 0 and 100),
  trigger_text    text not null,
  summary         text not null,
  rationale       text not null,
  action          text not null,
  sources         text[] not null default '{}',
  before_state    jsonb not null default '{}'::jsonb,
  after_state     jsonb not null default '{}'::jsonb,
  status          review_status not null default 'pendente',
  decision_note   text,
  decided_at      timestamptz,
  decided_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index ai_reviews_queue_idx on ai_reviews(professional_id, status, created_at desc);
create index ai_reviews_patient_idx on ai_reviews(patient_id, created_at desc);

comment on table ai_reviews is
  'Fila de propostas da IA. Nada chega ao paciente com status = pendente.';

-- ------------------------------------------------------------ MENSAGENS ---

create table conversations (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references profiles(id) on delete cascade,
  professional_id uuid not null references profiles(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (patient_id, professional_id)
);

create index conversations_pro_idx on conversations(professional_id, last_message_at desc);
create index conversations_patient_idx on conversations(patient_id, last_message_at desc);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid references profiles(id) on delete set null,
  sender_kind     sender_kind not null,
  body            text not null,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index messages_conversation_idx on messages(conversation_id, created_at);

-- --------------------------------------------------------- FATURAMENTO ----

create table subscriptions (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references profiles(id) on delete cascade,
  tier          plan_tier not null,
  amount_cents  integer not null check (amount_cents >= 0),
  is_active     boolean not null default true,
  started_on    date not null default current_date,
  next_charge_on date,
  created_at    timestamptz not null default now()
);

create index subscriptions_patient_idx on subscriptions(patient_id);

create table transactions (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references profiles(id) on delete cascade,
  subscription_id uuid references subscriptions(id) on delete set null,
  amount_cents    integer not null,
  status          payment_status not null default 'pendente',
  occurred_at     timestamptz not null default now()
);

create index transactions_patient_idx on transactions(patient_id, occurred_at desc);

-- ------------------------------------------------------- NOTIFICAÇÕES ----

create table notification_prefs (
  profile_id       uuid primary key references profiles(id) on delete cascade,
  protocol_changes boolean not null default true,
  workout_reminder boolean not null default true,
  exam_results     boolean not null default false,
  updated_at       timestamptz not null default now()
);


-- >>>>>>>>>>>>>>>>>>>>>>>>>> 20260101000001_rls.sql <<<<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- RYSE — ROW LEVEL SECURITY
-- =============================================================================
-- Regra geral: dado clínico só é visível para o próprio paciente e para o
-- profissional vinculado a ele (`profiles.professional_id`).
--
-- Escrita segue a autoria real do dado:
--   - o paciente escreve o que ele mesmo registra (hidratação, refeição
--     marcada, série de treino, check-in);
--   - o profissional escreve o que ele prescreve (planos, protocolos) e é o
--     único que decide uma revisão da IA.
-- =============================================================================

alter table profiles          enable row level security;
alter table body_metrics      enable row level security;
alter table hydration_logs    enable row level security;
alter table nutrition_plans   enable row level security;
alter table meals             enable row level security;
alter table meal_items        enable row level security;
alter table meal_logs         enable row level security;
alter table workout_plans     enable row level security;
alter table workouts          enable row level security;
alter table exercises         enable row level security;
alter table workout_sessions  enable row level security;
alter table set_logs          enable row level security;
alter table checkins          enable row level security;
alter table exams             enable row level security;
alter table exam_markers      enable row level security;
alter table protocols         enable row level security;
alter table ai_reviews        enable row level security;
alter table conversations     enable row level security;
alter table messages          enable row level security;
alter table subscriptions     enable row level security;
alter table transactions      enable row level security;
alter table notification_prefs enable row level security;

-- ---------------------------------------------------------------- PROFILES --

create policy "perfil próprio é legível"
  on profiles for select
  using (id = auth.uid());

create policy "profissional lê seus pacientes"
  on profiles for select
  using (professional_id = auth.uid());

-- O paciente precisa ver o nome do profissional dele na tela de mensagens.
-- A consulta vai por my_professional_id() (SECURITY DEFINER): um subselect
-- direto em `profiles` aqui dispararia a própria política, em recursão.
create policy "paciente lê o profissional responsável"
  on profiles for select
  using (id = my_professional_id());

create policy "perfil próprio é editável"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profissional edita ficha dos seus pacientes"
  on profiles for update
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

-- INSERT fica a cargo do trigger `handle_new_user` (SECURITY DEFINER).
-- Nenhuma política de INSERT é criada aqui de propósito.

-- ------------------------------------------------- DADOS CLÍNICOS DO PACIENTE

-- Tabelas com `patient_id` direto e mesmo padrão de acesso.
do $BODY$
declare
  t text;
begin
  foreach t in array array[
    'body_metrics', 'hydration_logs', 'meal_logs',
    'workout_sessions', 'checkins', 'exams'
  ]
  loop
    execute format(
      'create policy "leitura: paciente e profissional vinculado" on %I '
      'for select using (can_read_patient(patient_id))', t);

    execute format(
      'create policy "paciente registra o próprio dado" on %I '
      'for insert with check (patient_id = auth.uid())', t);

    execute format(
      'create policy "paciente edita o próprio dado" on %I '
      'for update using (patient_id = auth.uid()) '
      'with check (patient_id = auth.uid())', t);

    execute format(
      'create policy "paciente apaga o próprio dado" on %I '
      'for delete using (patient_id = auth.uid())', t);
  end loop;
end $BODY$;

-- O profissional também precisa lançar exames e métricas pelo paciente.
create policy "profissional lança exame do paciente"
  on exams for insert
  with check (is_my_patient(patient_id));

create policy "profissional lança métrica do paciente"
  on body_metrics for insert
  with check (is_my_patient(patient_id));

-- ------------------------------------------------------ PRESCRIÇÕES (PLANOS)

-- Planos: paciente lê o seu; profissional lê e escreve os dos seus pacientes.
do $BODY$
declare
  t text;
begin
  foreach t in array array['nutrition_plans', 'workout_plans']
  loop
    execute format(
      'create policy "leitura: paciente e profissional vinculado" on %I '
      'for select using (can_read_patient(patient_id))', t);

    execute format(
      'create policy "profissional prescreve" on %I '
      'for insert with check (is_my_patient(patient_id))', t);

    execute format(
      'create policy "profissional altera a prescrição" on %I '
      'for update using (is_my_patient(patient_id)) '
      'with check (is_my_patient(patient_id))', t);

    execute format(
      'create policy "profissional remove a prescrição" on %I '
      'for delete using (is_my_patient(patient_id))', t);
  end loop;
end $BODY$;

-- ------------------------------------------- FILHOS DOS PLANOS (via join) ---

create policy "leitura de refeição segue o plano"
  on meals for select
  using (exists (
    select 1 from nutrition_plans p
    where p.id = meals.plan_id and can_read_patient(p.patient_id)
  ));

create policy "profissional escreve refeição"
  on meals for all
  using (exists (
    select 1 from nutrition_plans p
    where p.id = meals.plan_id and is_my_patient(p.patient_id)
  ))
  with check (exists (
    select 1 from nutrition_plans p
    where p.id = meals.plan_id and is_my_patient(p.patient_id)
  ));

create policy "leitura de item segue a refeição"
  on meal_items for select
  using (exists (
    select 1 from meals m
    join nutrition_plans p on p.id = m.plan_id
    where m.id = meal_items.meal_id and can_read_patient(p.patient_id)
  ));

create policy "profissional escreve item"
  on meal_items for all
  using (exists (
    select 1 from meals m
    join nutrition_plans p on p.id = m.plan_id
    where m.id = meal_items.meal_id and is_my_patient(p.patient_id)
  ))
  with check (exists (
    select 1 from meals m
    join nutrition_plans p on p.id = m.plan_id
    where m.id = meal_items.meal_id and is_my_patient(p.patient_id)
  ));

create policy "leitura de ficha segue o plano"
  on workouts for select
  using (exists (
    select 1 from workout_plans p
    where p.id = workouts.plan_id and can_read_patient(p.patient_id)
  ));

create policy "profissional escreve ficha"
  on workouts for all
  using (exists (
    select 1 from workout_plans p
    where p.id = workouts.plan_id and is_my_patient(p.patient_id)
  ))
  with check (exists (
    select 1 from workout_plans p
    where p.id = workouts.plan_id and is_my_patient(p.patient_id)
  ));

create policy "leitura de exercício segue a ficha"
  on exercises for select
  using (exists (
    select 1 from workouts w
    join workout_plans p on p.id = w.plan_id
    where w.id = exercises.workout_id and can_read_patient(p.patient_id)
  ));

create policy "profissional escreve exercício"
  on exercises for all
  using (exists (
    select 1 from workouts w
    join workout_plans p on p.id = w.plan_id
    where w.id = exercises.workout_id and is_my_patient(p.patient_id)
  ))
  with check (exists (
    select 1 from workouts w
    join workout_plans p on p.id = w.plan_id
    where w.id = exercises.workout_id and is_my_patient(p.patient_id)
  ));

-- Séries registradas durante a sessão: quem treina escreve.
create policy "leitura de série segue a sessão"
  on set_logs for select
  using (exists (
    select 1 from workout_sessions s
    where s.id = set_logs.session_id and can_read_patient(s.patient_id)
  ));

create policy "paciente registra a própria série"
  on set_logs for all
  using (exists (
    select 1 from workout_sessions s
    where s.id = set_logs.session_id and s.patient_id = auth.uid()
  ))
  with check (exists (
    select 1 from workout_sessions s
    where s.id = set_logs.session_id and s.patient_id = auth.uid()
  ));

-- Marcadores seguem o exame.
create policy "leitura de marcador segue o exame"
  on exam_markers for select
  using (exists (
    select 1 from exams e
    where e.id = exam_markers.exam_id and can_read_patient(e.patient_id)
  ));

create policy "profissional escreve marcador"
  on exam_markers for all
  using (exists (
    select 1 from exams e
    where e.id = exam_markers.exam_id and is_my_patient(e.patient_id)
  ))
  with check (exists (
    select 1 from exams e
    where e.id = exam_markers.exam_id and is_my_patient(e.patient_id)
  ));

-- ------------------------------------------------------------- PROTOCOLOS --

create policy "profissional gerencia os próprios protocolos"
  on protocols for all
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

-- --------------------------------------------------------- REVISÃO DA IA ---

-- O paciente NÃO vê a fila: uma proposta pendente não é uma prescrição.
create policy "profissional lê a própria fila"
  on ai_reviews for select
  using (professional_id = auth.uid());

-- Depois de decidida, o paciente pode ver o que mudou no protocolo dele.
create policy "paciente lê revisões já decididas"
  on ai_reviews for select
  using (patient_id = auth.uid() and status <> 'pendente');

create policy "profissional decide a revisão"
  on ai_reviews for update
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

-- --------------------------------------------------------------- MENSAGENS --

create policy "participantes leem a conversa"
  on conversations for select
  using (patient_id = auth.uid() or professional_id = auth.uid());

create policy "participantes abrem a conversa"
  on conversations for insert
  with check (patient_id = auth.uid() or professional_id = auth.uid());

create policy "participantes atualizam a conversa"
  on conversations for update
  using (patient_id = auth.uid() or professional_id = auth.uid())
  with check (patient_id = auth.uid() or professional_id = auth.uid());

create policy "participantes leem as mensagens"
  on messages for select
  using (exists (
    select 1 from conversations c
    where c.id = messages.conversation_id
      and (c.patient_id = auth.uid() or c.professional_id = auth.uid())
  ));

-- `sender_id = auth.uid()` impede escrever em nome de outra pessoa.
create policy "participantes enviam mensagem"
  on messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and (c.patient_id = auth.uid() or c.professional_id = auth.uid())
    )
  );

create policy "remetente marca como lida"
  on messages for update
  using (exists (
    select 1 from conversations c
    where c.id = messages.conversation_id
      and (c.patient_id = auth.uid() or c.professional_id = auth.uid())
  ))
  with check (exists (
    select 1 from conversations c
    where c.id = messages.conversation_id
      and (c.patient_id = auth.uid() or c.professional_id = auth.uid())
  ));

-- ------------------------------------------------------------ FATURAMENTO --

create policy "leitura de assinatura"
  on subscriptions for select
  using (can_read_patient(patient_id));

create policy "profissional gerencia assinatura"
  on subscriptions for all
  using (is_my_patient(patient_id))
  with check (is_my_patient(patient_id));

create policy "leitura de transação"
  on transactions for select
  using (can_read_patient(patient_id));

create policy "profissional lança transação"
  on transactions for insert
  with check (is_my_patient(patient_id));

-- ---------------------------------------------------------- NOTIFICAÇÕES ---

create policy "preferências próprias"
  on notification_prefs for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());


-- >>>>>>>>>>>>>>>>>>>>>>>>>> 20260101000002_functions.sql <<<<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- RYSE — TRIGGERS E FUNÇÕES DE APOIO
-- =============================================================================

-- ------------------------------------------------ PERFIL AUTOMÁTICO ---------

-- Cria o perfil assim que o usuário se cadastra. `full_name` e `role` chegam
-- pelo `options.data` do signUp; `role` é forçado a 'paciente' para que
-- ninguém consiga virar profissional por conta própria pelo cadastro público.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    'paciente'
  )
  on conflict (id) do nothing;

  insert into notification_prefs (profile_id)
  values (new.id)
  on conflict (profile_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

comment on function handle_new_user is
  'Cadastro público sempre nasce como paciente. Promoção a profissional é manual.';

-- Mantém o e-mail do perfil em sincronia com o do auth.
create or replace function sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update profiles set email = new.email, updated_at = now() where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_change on auth.users;
create trigger on_auth_user_email_change
  after update of email on auth.users
  for each row execute function sync_profile_email();

-- ------------------------------------------------------------- UPDATED_AT --

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch
  before update on profiles
  for each row execute function touch_updated_at();

create trigger notification_prefs_touch
  before update on notification_prefs
  for each row execute function touch_updated_at();

-- ---------------------------------------------------- CONVERSA: ÚLTIMA MSG --

create or replace function bump_conversation()
returns trigger
language plpgsql
as $$
begin
  update conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_bump_conversation
  after insert on messages
  for each row execute function bump_conversation();

-- ------------------------------------------- DECISÃO CLÍNICA (CARIMBO) -----

-- Sempre que a fila sai de 'pendente', registra quem decidiu e quando.
create or replace function stamp_review_decision()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status and new.status <> 'pendente' then
    new.decided_at = now();
    new.decided_by = auth.uid();
  end if;
  return new;
end;
$$;

create trigger ai_reviews_stamp
  before update on ai_reviews
  for each row execute function stamp_review_decision();

-- --------------------------------------------------- HIDRATAÇÃO DO DIA -----

-- Soma em ml do que o paciente bebeu num dia. SECURITY INVOKER de propósito:
-- a RLS de `hydration_logs` continua valendo dentro da função.
create or replace function hydration_total_ml(target_patient uuid, target_day date)
returns integer
language sql
stable
as $$
  select coalesce(sum(amount_ml), 0)::integer
    from hydration_logs
   where patient_id = target_patient
     and logged_on = target_day;
$$;

-- ------------------------------------------------------ ADESÃO SEMANAL -----

-- Percentual de refeições marcadas sobre as prescritas, por semana.
create or replace function weekly_adherence(target_patient uuid, weeks integer default 8)
returns table (week_start date, adherence integer)
language sql
stable
as $$
  with plan as (
    select count(*)::numeric as meals_per_day
      from meals m
      join nutrition_plans p on p.id = m.plan_id
     where p.patient_id = target_patient and p.is_active
  ),
  span as (
    select generate_series(
      date_trunc('week', current_date)::date - ((weeks - 1) * 7),
      date_trunc('week', current_date)::date,
      '7 days'
    )::date as week_start
  )
  select s.week_start,
         case
           when plan.meals_per_day is null or plan.meals_per_day = 0 then 0
           else least(
             100,
             round(
               count(ml.id) * 100.0 / (plan.meals_per_day * 7)
             )
           )::integer
         end as adherence
    from span s
    cross join plan
    left join meal_logs ml
           on ml.patient_id = target_patient
          and ml.logged_on >= s.week_start
          and ml.logged_on < s.week_start + 7
   group by s.week_start, plan.meals_per_day
   order by s.week_start;
$$;

-- ---------------------------------------------- VÍNCULO PACIENTE-PROFISSIONAL

-- Abre (ou reaproveita) a conversa entre um paciente e o profissional dele.
create or replace function ensure_conversation(target_patient uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  pro_id uuid;
  convo_id uuid;
begin
  select professional_id into pro_id from profiles where id = target_patient;
  if pro_id is null then
    return null;
  end if;

  -- Só o próprio paciente ou o profissional dele podem abrir a conversa.
  if auth.uid() <> target_patient and auth.uid() <> pro_id then
    raise exception 'sem permissão para abrir esta conversa';
  end if;

  insert into conversations (patient_id, professional_id)
  values (target_patient, pro_id)
  on conflict (patient_id, professional_id) do update
    set last_message_at = conversations.last_message_at
  returning id into convo_id;

  return convo_id;
end;
$$;


-- >>>>>>>>>>>>>>>>>>>>>>>>>> 20260101000003_documentos.sql <<<<<<<<<<<<<<<<<<<<<<<<<<

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


-- >>>>>>>>>>>>>>>>>>>>>>>>>> 20260101000004_escolha_profissional.sql <<<<<<<<<<<<<<<<<<<<<<<<<<

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


-- >>>>>>>>>>>>>>>>>>>>>>>>>> 20260101000005_plataforma.sql <<<<<<<<<<<<<<<<<<<<<<<<<<

-- =============================================================================
-- RYSE — EVOLUÇÃO DA PLATAFORMA
-- =============================================================================
-- Reúne, numa migration só, o que a atualização precisa no banco:
--
--   1. onboarding  — os campos que personalizam a experiência
--   2. avatar      — bucket público e política de escrita por dono
--   3. hidratação  — meta calculada, com override manual opcional
--   4. IA          — protocolo de análise, cota de uso e saídas geradas
--   5. push        — inscrições de dispositivo, preferências e fila de envio
--
-- Nada aqui afrouxa a RLS: toda tabela nova nasce com política própria.
-- =============================================================================

-- ============================================================== ONBOARDING ==

/*
  O primeiro acesso passa por um formulário. `onboarded_at` já existia e vira
  a chave do portão: nulo = perfil incompleto = dashboard bloqueado.

  Os campos abaixo são exatamente o que a IA usa para personalizar dieta,
  ficha e relatório. Nada é decorativo.
*/
/*
  Uma coluna por comando, e as restrições depois — não como CHECK inline.

  Agrupar as nove num único ALTER é mais compacto, mas transforma o bloco em
  tudo-ou-nada: basta um detalhe em qualquer cláusula para as outras oito não
  entrarem. O resultado é o pior dos estados, porque parece que a migration
  rodou: as tabelas mais adiante são criadas, as colunas não, e o login quebra
  com uma mensagem que aponta para o lugar errado.

  Separadas, uma falha isolada não leva as demais junto.
*/
alter table profiles add column if not exists sex               text;
alter table profiles add column if not exists activity_level    text;
alter table profiles add column if not exists training_level    text;
alter table profiles add column if not exists training_days     integer;
alter table profiles add column if not exists routine           text;
alter table profiles add column if not exists food_preferences  text[] not null default '{}';
alter table profiles add column if not exists food_restrictions text[] not null default '{}';
alter table profiles add column if not exists health_notes      text;
alter table profiles add column if not exists timezone          text not null default 'America/Sao_Paulo';

-- As restrições vêm em seguida: assim uma linha antiga com valor fora da
-- faixa impede só o ADD CONSTRAINT, e não o nascimento da coluna.
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

comment on column profiles.onboarded_at is
  'Marca o fim do formulário inicial. NULL = o app redireciona para /onboarding.';

/*
  Meta de hidratação.

  `water_goal_ml` continua na tabela por compatibilidade, mas deixou de ser a
  fonte de verdade: a meta é calculada a partir de peso, altura, idade e
  rotina (ver `lib/hydration.ts`). Guardar o número calculado no banco criaria
  uma segunda fórmula, que envelheceria assim que o peso mudasse.

  O override existe para quando o profissional prescreve um volume específico
  — aí o valor manual vence o cálculo, e só nesse caso.
*/
alter table profiles add column if not exists water_goal_override_ml integer;

alter table profiles drop constraint if exists profiles_water_goal_override_ml_check;
alter table profiles add constraint profiles_water_goal_override_ml_check
  check (
    water_goal_override_ml is null
    or water_goal_override_ml between 500 and 10000
  );

comment on column profiles.water_goal_override_ml is
  'Meta manual. NULL = usar o cálculo automático a partir do peso mais recente.';

-- Peso mais recente do paciente, em kg. A meta de água e o contexto da IA
-- dependem dele; centralizar aqui evita repetir o "order by ... limit 1".
create or replace function latest_weight_kg(target_patient uuid)
returns numeric
language sql
stable
as $fn$
  select weight_kg
    from body_metrics
   where patient_id = target_patient
     and weight_kg is not null
   order by measured_on desc
   limit 1;
$fn$;

-- ================================================================= AVATAR ==

/*
  Bucket público de propósito: o avatar aparece no menu, no cabeçalho e na
  lista de pacientes — emitir signed URL a cada render custaria uma ida ao
  Storage por imagem. Não há dado clínico numa foto de perfil.

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

-- ==================================================== PROTOCOLO DE ANÁLISE ==

do $enum$
begin
  if not exists (select 1 from pg_type where typname = 'ai_priority') then
    create type ai_priority as enum ('baixa', 'media', 'alta');
  end if;
  if not exists (select 1 from pg_type where typname = 'ai_detail_level') then
    create type ai_detail_level as enum ('resumido', 'padrao', 'completo');
  end if;
end
$enum$;

/*
  Pré-definição que o profissional configura para orientar a IA sobre um
  paciente específico. Uma linha por paciente — editar substitui.

  `scopes` diz o que entra na análise. A camada de contexto lê esse array e
  simplesmente não monta as seções não pedidas: dado que não foi solicitado
  não sai do banco.
*/
create table if not exists ai_protocols (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null unique references profiles(id) on delete cascade,
  professional_id uuid not null references profiles(id) on delete cascade,
  objective       text not null,
  priority        ai_priority not null default 'media',
  scopes          text[] not null default array['saude','exames','treino','nutricao','evolucao','checkins'],
  detail_level    ai_detail_level not null default 'completo',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint ai_protocols_objective_not_blank check (length(btrim(objective)) >= 3)
);

create index if not exists ai_protocols_professional_idx on ai_protocols(professional_id);

comment on table ai_protocols is
  'Protocolo de análise da IA: o profissional define objetivo, escopo e profundidade antes de a IA rodar.';

alter table ai_protocols enable row level security;

drop policy if exists "protocolo de análise: paciente e profissional leem" on ai_protocols;
create policy "protocolo de análise: paciente e profissional leem"
  on ai_protocols for select
  using (can_read_patient(patient_id));

drop policy if exists "profissional cria o protocolo do seu paciente" on ai_protocols;
create policy "profissional cria o protocolo do seu paciente"
  on ai_protocols for insert
  with check (is_my_patient(patient_id) and professional_id = auth.uid());

drop policy if exists "profissional edita o protocolo do seu paciente" on ai_protocols;
create policy "profissional edita o protocolo do seu paciente"
  on ai_protocols for update
  using (is_my_patient(patient_id))
  with check (is_my_patient(patient_id) and professional_id = auth.uid());

drop policy if exists "profissional apaga o protocolo do seu paciente" on ai_protocols;
create policy "profissional apaga o protocolo do seu paciente"
  on ai_protocols for delete
  using (is_my_patient(patient_id));

drop trigger if exists ai_protocols_touch on ai_protocols;
create trigger ai_protocols_touch
  before update on ai_protocols
  for each row execute function touch_updated_at();

-- =========================================================== USO DA IA ======

do $enum$
begin
  if not exists (select 1 from pg_type where typname = 'ai_request_kind') then
    create type ai_request_kind as enum (
      'dieta',                -- geração de plano alimentar     — 1 por mês
      'ficha_treino',         -- geração de ficha de treino     — 1 por mês
      'relatorio_nutricao',   -- relatório da área de nutrição  — 1 por mês
      'relatorio_treino',     -- relatório da área de treino    — 1 por mês
      'relatorio_saude',      -- relatório da área de saúde     — 1 por mês
      'relatorio_exames',     -- relatório de exames            — 1 por semana
      'analise_protocolo'     -- análise disparada pelo profissional
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'ai_request_status') then
    create type ai_request_status as enum ('reservado', 'concluido', 'falhou');
  end if;
end
$enum$;

/*
  Registro de uso — é o que faz o limite existir de verdade.

  A coluna `period_key` guarda a janela já resolvida ('2026-08' para limite
  mensal, '2026-W35' para semanal). O índice único sobre
  (profile_id, kind, period_key) transforma o limite numa restrição do banco:
  duas requisições simultâneas não conseguem furar a cota, porque a segunda
  esbarra na unicidade. Checar com SELECT antes do INSERT deixaria essa
  brecha aberta.

  Fluxo: reserva a linha -> chama a IA -> marca 'concluido'. Se a IA falhar,
  a reserva é apagada e a cota volta para o usuário.
*/
create table if not exists ai_usage (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id) on delete cascade,
  patient_id   uuid not null references profiles(id) on delete cascade,
  kind         ai_request_kind not null,
  period_key   text not null,
  status       ai_request_status not null default 'reservado',
  output_id    uuid,
  error_text   text,
  requested_at timestamptz not null default now(),
  finished_at  timestamptz
);

create unique index if not exists ai_usage_quota_idx
  on ai_usage(profile_id, kind, period_key);

create index if not exists ai_usage_profile_idx on ai_usage(profile_id, requested_at desc);

comment on index ai_usage_quota_idx is
  'O limite de uso da IA. Sem este índice, duas abas simultâneas furariam a cota.';

alter table ai_usage enable row level security;

drop policy if exists "uso da IA: dono lê" on ai_usage;
create policy "uso da IA: dono lê"
  on ai_usage for select
  using (profile_id = auth.uid() or can_read_patient(patient_id));

-- O paciente registra o próprio uso, mas não apaga: um DELETE aberto seria o
-- mesmo que não ter limite. A devolução de cota passa por
-- `release_ai_reservation`, que só desfaz reserva ainda sem resultado.
drop policy if exists "uso da IA: dono registra" on ai_usage;
create policy "uso da IA: dono registra"
  on ai_usage for insert
  with check (profile_id = auth.uid());

drop policy if exists "uso da IA: dono conclui" on ai_usage;
create policy "uso da IA: dono conclui"
  on ai_usage for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create or replace function release_ai_reservation(reservation uuid)
returns void
language sql
security definer
set search_path = public
as $fn$
  delete from ai_usage
   where id = reservation
     and profile_id = auth.uid()
     and status = 'reservado';
$fn$;

revoke execute on function release_ai_reservation(uuid) from anon;
grant execute on function release_ai_reservation(uuid) to authenticated;

-- ====================================================== SAÍDAS GERADAS =====

do $enum$
begin
  if not exists (select 1 from pg_type where typname = 'ai_output_kind') then
    create type ai_output_kind as enum (
      'dieta', 'ficha_treino', 'relatorio_nutricao', 'relatorio_treino',
      'relatorio_saude', 'relatorio_exames', 'analise_protocolo'
    );
  end if;
end
$enum$;

/*
  O que a IA produziu, guardado em jsonb.

  Guardar a saída importa por dois motivos: o paciente reabre o resultado sem
  gastar a cota de novo, e o profissional vê o que a IA disse quando for
  revisar o caso.
*/
create table if not exists ai_outputs (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references profiles(id) on delete cascade,
  created_by  uuid references profiles(id) on delete set null,
  kind        ai_output_kind not null,
  title       text not null,
  content     jsonb not null default '{}'::jsonb,
  model       text,
  created_at  timestamptz not null default now()
);

create index if not exists ai_outputs_patient_idx
  on ai_outputs(patient_id, kind, created_at desc);

alter table ai_outputs enable row level security;

drop policy if exists "saída da IA: paciente e profissional leem" on ai_outputs;
create policy "saída da IA: paciente e profissional leem"
  on ai_outputs for select
  using (can_read_patient(patient_id));

drop policy if exists "saída da IA: quem pode ler o paciente grava" on ai_outputs;
create policy "saída da IA: quem pode ler o paciente grava"
  on ai_outputs for insert
  with check (can_read_patient(patient_id) and created_by = auth.uid());

drop policy if exists "saída da IA: paciente apaga a própria" on ai_outputs;
create policy "saída da IA: paciente apaga a própria"
  on ai_outputs for delete
  using (patient_id = auth.uid());

-- ========================================================= NOTIFICAÇÕES ====

/*
  Preferências por categoria. As três colunas antigas continuam de pé — a
  tela de perfil já escrevia nelas — e ganham companhia das categorias que a
  atualização pede.
*/
alter table notification_prefs
  add column if not exists general_enabled    boolean not null default true,
  add column if not exists hydration_reminder boolean not null default true,
  add column if not exists checkin_reminder   boolean not null default true,
  add column if not exists reports            boolean not null default false,
  add column if not exists messages           boolean not null default true,
  -- Janela de silêncio, no fuso do usuário.
  add column if not exists quiet_from         time not null default '22:00',
  add column if not exists quiet_to           time not null default '07:00';

comment on column notification_prefs.quiet_from is
  'Início do silêncio, no fuso de profiles.timezone. Envio dentro da janela é adiado, não descartado.';

/*
  Inscrições de Web Push.

  Web Push padrão (VAPID) em vez de um serviço proprietário: funciona no
  Android, no desktop e no iOS 16.4+ quando o app está na tela de início,
  não custa nada e não exige SDK de terceiro.

  `endpoint` é único: reinstalar o app gera um endpoint novo, e o antigo sai
  quando o provedor responde 404/410.
*/
create table if not exists push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  -- Quando o provedor recusou a inscrição. Linha marcada não recebe mais.
  expired_at   timestamptz
);

create index if not exists push_subscriptions_profile_idx
  on push_subscriptions(profile_id) where expired_at is null;

alter table push_subscriptions enable row level security;

drop policy if exists "push: dono lê as próprias inscrições" on push_subscriptions;
create policy "push: dono lê as próprias inscrições"
  on push_subscriptions for select
  using (profile_id = auth.uid());

drop policy if exists "push: dono registra o dispositivo" on push_subscriptions;
create policy "push: dono registra o dispositivo"
  on push_subscriptions for insert
  with check (profile_id = auth.uid());

drop policy if exists "push: dono atualiza o dispositivo" on push_subscriptions;
create policy "push: dono atualiza o dispositivo"
  on push_subscriptions for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists "push: dono remove o dispositivo" on push_subscriptions;
create policy "push: dono remove o dispositivo"
  on push_subscriptions for delete
  using (profile_id = auth.uid());

do $enum$
begin
  if not exists (select 1 from pg_type where typname = 'notification_category') then
    create type notification_category as enum (
      'geral', 'treino', 'hidratacao', 'checkin', 'relatorio', 'mensagem'
    );
  end if;
end
$enum$;

/*
  Fila de envio.

  Agendar em vez de disparar na hora resolve três coisas de uma vez: respeita
  a janela de silêncio (a linha fica esperando), sobrevive a um dispositivo
  offline e deixa rastro do que foi enviado.
*/
create table if not exists notifications (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles(id) on delete cascade,
  category      notification_category not null,
  title         text not null,
  body          text not null,
  url           text,
  scheduled_for timestamptz not null default now(),
  sent_at       timestamptz,
  read_at       timestamptz,
  skip_reason   text,
  created_at    timestamptz not null default now()
);

create index if not exists notifications_due_idx
  on notifications(scheduled_for) where sent_at is null and skip_reason is null;

create index if not exists notifications_profile_idx
  on notifications(profile_id, created_at desc);

alter table notifications enable row level security;

drop policy if exists "notificação: destinatário lê" on notifications;
create policy "notificação: destinatário lê"
  on notifications for select
  using (profile_id = auth.uid());

drop policy if exists "notificação: destinatário marca como lida" on notifications;
create policy "notificação: destinatário marca como lida"
  on notifications for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- O profissional avisa o paciente dele; o próprio usuário agenda os lembretes.
drop policy if exists "notificação: profissional avisa o paciente" on notifications;
create policy "notificação: profissional avisa o paciente"
  on notifications for insert
  with check (profile_id = auth.uid() or is_my_patient(profile_id));

/*
  Mensagem nova vira notificação.

  Fazer isso no banco garante que vale para qualquer caminho de escrita —
  chat do paciente, chat do profissional ou uma inserção futura pela IA.
  Quem recebe é sempre o outro lado da conversa.
*/
create or replace function notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  convo       record;
  target      uuid;
  sender_name text;
begin
  select patient_id, professional_id into convo
    from conversations where id = new.conversation_id;

  if convo is null then
    return new;
  end if;

  target := case when convo.patient_id = new.sender_id
                 then convo.professional_id
                 else convo.patient_id end;

  if target is null or target = new.sender_id then
    return new;
  end if;

  select full_name into sender_name from profiles where id = new.sender_id;

  insert into notifications (profile_id, category, title, body, url)
  values (
    target,
    'mensagem',
    coalesce(sender_name, 'Nova mensagem'),
    left(new.body, 140),
    case when target = convo.patient_id then '/mensagens' else '/pro/mensagens' end
  );

  return new;
end;
$fn$;

drop trigger if exists messages_notify on messages;
create trigger messages_notify
  after insert on messages
  for each row execute function notify_new_message();

-- ==================================================== CHECK-IN SEMANAL =====

/*
  Semana do check-in, no fuso do usuário.

  `date_trunc('week')` do Postgres já começa na segunda, mas roda no fuso do
  servidor — em UTC, domingo às 22h em São Paulo cairia na semana seguinte.
  Por isso o fuso do perfil entra na conta.
*/
create or replace function current_week_start(target_profile uuid)
returns date
language sql
stable
security definer
set search_path = public
as $fn$
  select date_trunc(
    'week',
    (now() at time zone coalesce(
      (select timezone from profiles where id = target_profile),
      'America/Sao_Paulo'
    ))
  )::date;
$fn$;

/* Check-in pendente = não existe linha para a semana corrente. */
create or replace function checkin_pending(target_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select not exists (
    select 1 from checkins
     where patient_id = target_patient
       and week_start = current_week_start(target_patient)
  );
$fn$;

grant execute on function current_week_start(uuid) to authenticated;
grant execute on function checkin_pending(uuid) to authenticated;
grant execute on function latest_weight_kg(uuid) to authenticated;

-- ==================================================== TEMPO REAL ===========

/*
  Publicação do Realtime.

  As telas de acompanhamento se atualizam sozinhas quando o dado muda — seja
  por um registro feito no celular, por um lançamento do profissional ou por
  uma saída da IA. Sem a tabela na publicação, o canal conecta mas nunca
  recebe evento algum, e o "atualiza sozinho" vira promessa vazia.

  A RLS continua valendo no canal: cada assinante só recebe as linhas que já
  poderia ler por SELECT.
*/
do $realtime$
declare
  t text;
begin
  foreach t in array array[
    'body_metrics',
    'hydration_logs',
    'meal_logs',
    'workout_sessions',
    'checkins',
    'exams',
    'health_documents',
    'ai_outputs',
    'notifications',
    'messages'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$realtime$;

-- ============================================ ENDURECIMENTO DA COTA DE IA ==

/*
  A primeira versão das políticas de `ai_usage` deixava o próprio usuário dar
  UPDATE na linha de uso. Isso furava o limite por dois caminhos: bastava
  marcar a linha como 'falhou' (que a contagem ignorava) ou trocar
  `period_key` para liberar o índice único.

  A correção tira a escrita livre das mãos do cliente:

    - reservar  -> INSERT continua permitido (é o que cria a trava);
    - concluir  -> função SECURITY DEFINER, que só muda o status;
    - devolver  -> função SECURITY DEFINER, que só apaga reserva pendente.

  Com a falha sendo APAGADA em vez de marcada, a contagem passa a ser
  simplesmente "existe linha nesta janela?" — não há mais status que a
  consulta precise ignorar, e portanto não há status que o usuário possa
  forjar.
*/

drop policy if exists "uso da IA: dono conclui" on ai_usage;

-- O paciente referenciado precisa ser alguém que o autor pode ler: sem isso,
-- daria para criar linha apontando para o prontuário de outra pessoa.
drop policy if exists "uso da IA: dono registra" on ai_usage;
create policy "uso da IA: dono registra"
  on ai_usage for insert
  with check (profile_id = auth.uid() and can_read_patient(patient_id));

create or replace function complete_ai_reservation(reservation uuid, output uuid)
returns void
language sql
security definer
set search_path = public
as $fn$
  update ai_usage
     set status      = 'concluido',
         output_id   = output,
         finished_at = now()
   where id = reservation
     and profile_id = auth.uid()
     and status = 'reservado';
$fn$;

revoke execute on function complete_ai_reservation(uuid, uuid) from anon;
grant execute on function complete_ai_reservation(uuid, uuid) to authenticated;

comment on function complete_ai_reservation is
  'Fecha a reserva. É o único caminho de escrita do usuário em ai_usage depois do INSERT.';


-- >>>>>>>>>>>>>>>>>>>>>>>>>> 20260101000006_admin_e_acesso.sql <<<<<<<<<<<<<<<<<<<<<<<<<<

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
alter table profiles
  add column if not exists must_change_password boolean not null default false;

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

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

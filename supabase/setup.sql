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
-- Ordem: schema -> RLS -> funções -> documentos -> escolha do profissional.
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

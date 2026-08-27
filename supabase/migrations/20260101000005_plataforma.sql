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
alter table profiles
  add column if not exists sex                text
    check (sex in ('feminino', 'masculino', 'outro')),
  add column if not exists activity_level     text
    check (activity_level in ('sedentario', 'leve', 'moderado', 'intenso', 'atleta')),
  add column if not exists training_level     text
    check (training_level in ('iniciante', 'intermediario', 'avancado')),
  add column if not exists training_days      integer
    check (training_days between 0 and 7),
  add column if not exists routine            text,
  add column if not exists food_preferences   text[] not null default '{}',
  add column if not exists food_restrictions  text[] not null default '{}',
  add column if not exists health_notes       text,
  add column if not exists timezone           text not null default 'America/Sao_Paulo';

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
alter table profiles
  add column if not exists water_goal_override_ml integer
    check (water_goal_override_ml between 500 and 10000);

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

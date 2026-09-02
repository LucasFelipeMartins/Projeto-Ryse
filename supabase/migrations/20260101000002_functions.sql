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

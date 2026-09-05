-- =============================================================================
-- RYSE — CORREÇÃO: funções da migration 005 que não entraram
-- =============================================================================
-- Descobertas por `npm run doctor` depois de corrigir um falso positivo no
-- próprio diagnóstico: ele só reconhecia o código 42883 como "função não
-- existe", mas quem responde é o PostgREST, com PGRST202. Três funções
-- estavam ausentes havia tempo, marcadas como presentes.
--
-- O que quebra sem elas: o cron de notificações não consegue saber quem está
-- devendo check-in, então esses lembretes nunca são enfileirados.
--
-- Seguro rodar quantas vezes quiser.
-- =============================================================================

-- ------------------------------------------------------- SEMANA DO USUÁRIO --

/*
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

-- ----------------------------------------------------- CHECK-IN PENDENTE ---

/* Pendente = não existe linha para a semana corrente do próprio usuário. */
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

-- --------------------------------------------------------- PESO RECENTE ----

/*
  Peso mais recente, em kg. A meta de hidratação e o contexto da IA dependem
  dele; centralizar aqui evita repetir o "order by ... limit 1" em cada
  consulta.
*/
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

grant execute on function current_week_start(uuid) to authenticated;
grant execute on function checkin_pending(uuid) to authenticated;
grant execute on function latest_weight_kg(uuid) to authenticated;

-- ------------------------------------------------------------ CONFERÊNCIA --

select
  p.proname as funcao,
  true as existe
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('current_week_start', 'checkin_pending', 'latest_weight_kg')
order by p.proname;

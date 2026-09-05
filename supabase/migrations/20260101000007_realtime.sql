-- =============================================================================
-- RYSE — TEMPO REAL
-- =============================================================================
-- Publica no Realtime as tabelas cujas telas se atualizam sozinhas, e expõe
-- uma função de diagnóstico para conferir isso de fora.
--
-- A RLS continua valendo no canal: cada assinante só recebe as linhas que já
-- poderia ler por SELECT. Publicar uma tabela não afrouxa nada — apenas
-- permite que a mudança seja anunciada a quem já tem permissão.
-- =============================================================================

-- --------------------------------------------------------- PUBLICAÇÃO -----

/*
  Sem a tabela na publicação, o canal conecta e nunca recebe evento algum.

  É uma falha particularmente ingrata: o cliente reporta "inscrito com
  sucesso", nenhum erro aparece em lugar nenhum, e a tela simplesmente não
  atualiza. Daí a função de diagnóstico logo abaixo.
*/
do $realtime$
declare
  t text;
begin
  foreach t in array array[
    -- mensagens: o chat entre paciente e profissional
    'messages',
    'conversations',
    -- acompanhamento: telas que refletem dado novo sem recarregar
    'body_metrics',
    'hydration_logs',
    'meal_logs',
    'workout_sessions',
    'checkins',
    'exams',
    'health_documents',
    'ai_outputs',
    'notifications'
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

/*
  Identidade da réplica.

  O Realtime envia o registro ANTIGO nos eventos de UPDATE e DELETE apenas
  para as colunas que fazem parte da identidade da réplica. No padrão
  (`DEFAULT`), isso é só a chave primária — o que basta aqui: o app usa os
  eventos para saber QUE algo mudou e reler, não para reconstruir o estado
  anterior.

  Registrado explicitamente porque `FULL` é uma escolha comum e cara: ela
  duplica o volume do WAL de cada update.
*/

-- ------------------------------------------------------- DIAGNÓSTICO ------

/*
  Quais tabelas estão publicadas.

  Existe porque não há como consultar `pg_publication_tables` pela API REST, e
  "o canal conecta mas não chega evento" é indistinguível de "a assinatura
  está errada" sem esse dado. `npm run doctor` chama esta função.

  SECURITY DEFINER para ler o catálogo, mas devolve só nomes de tabela — nada
  de dado de usuário.
*/
create or replace function realtime_tables()
returns table (tabela text)
language sql
stable
security definer
set search_path = public, pg_catalog
as $fn$
  select tablename::text
    from pg_publication_tables
   where pubname = 'supabase_realtime'
     and schemaname = 'public'
   order by tablename;
$fn$;

revoke execute on function realtime_tables() from anon;
grant execute on function realtime_tables() to authenticated;

comment on function realtime_tables is
  'Diagnóstico: tabelas publicadas no Realtime. Usada por npm run doctor.';

-- ------------------------------------------------------------ CONFERÊNCIA --

select tabela from realtime_tables();

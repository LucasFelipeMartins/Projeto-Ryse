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

-- =============================================================================
-- RYSE — DADOS DE DEMONSTRAÇÃO
-- =============================================================================
-- Rode DEPOIS de criar as duas contas pelo app (ou pelo painel do Supabase,
-- em Authentication > Users):
--
--   1. a conta do profissional
--   2. a conta do paciente
--
-- Troque os dois e-mails abaixo e execute o arquivo inteiro no SQL Editor.
-- O script é idempotente: pode rodar de novo sem duplicar nada.
--
-- NOTA: todas as variáveis usam o prefixo `v_`. Sem isso, um `where
-- patient_id = patient_id` compararia a coluna com ela mesma — sempre
-- verdadeiro — e o DELETE limparia a tabela inteira.
-- =============================================================================

do $$
declare
  -- >>> AJUSTE ESTES DOIS E-MAILS <<<
  v_pro_email     text := 'profissional@exemplo.com';
  v_patient_email text := 'paciente@exemplo.com';

  v_pro       uuid;
  v_patient   uuid;
  v_nut_plan  uuid;
  v_wrk_plan  uuid;
  v_workout_a uuid;
  v_workout_b uuid;
  v_exam      uuid;
  v_meal      uuid;
  v_sub       uuid;
begin
  select id into v_pro     from auth.users where email = v_pro_email;
  select id into v_patient from auth.users where email = v_patient_email;

  if v_pro is null then
    raise exception 'Conta do profissional não encontrada: %. Crie-a primeiro.', v_pro_email;
  end if;
  if v_patient is null then
    raise exception 'Conta do paciente não encontrada: %. Crie-a primeiro.', v_patient_email;
  end if;

  ---------------------------------------------------------------- PERFIS ----

  update profiles
     set role      = 'profissional',
         specialty = 'Nutrólogo e médico do esporte',
         crm       = 'CRM-SP 148.209'
   where id = v_pro;

  update profiles
     set role            = 'paciente',
         professional_id = v_pro,
         plan            = 'completo',
         goal            = 'Hipertrofia limpa',
         height_cm       = 178,
         water_goal_ml   = 3200,
         kcal_goal       = 2400
   where id = v_patient;

  ------------------------------------------------------------- NUTRIÇÃO ----

  delete from nutrition_plans where patient_id = v_patient;

  insert into nutrition_plans (patient_id, title, kcal_target, protein_g, carb_g, fat_g, created_by)
  values (v_patient, 'Hipertrofia limpa', 2400, 160, 280, 70, v_pro)
  returning id into v_nut_plan;

  insert into meals (plan_id, slot, label, serve_at, title, kcal, protein_g, carb_g, fat_g, swappable, position)
  values (v_nut_plan, 'cafe', 'Café da manhã', '07:00', 'Ovos, aveia e fruta', 520, 34, 58, 16, false, 0)
  returning id into v_meal;
  insert into meal_items (meal_id, description, position) values
    (v_meal, '3 ovos inteiros', 0),
    (v_meal, '60 g de aveia', 1),
    (v_meal, '1 banana', 2),
    (v_meal, 'Café sem açúcar', 3);

  insert into meals (plan_id, slot, label, serve_at, title, kcal, protein_g, carb_g, fat_g, swappable, position)
  values (v_nut_plan, 'almoco', 'Almoço', '12:30', 'Carne bovina, arroz e salada', 620, 38, 48, 12, true, 1)
  returning id into v_meal;
  insert into meal_items (meal_id, description, position) values
    (v_meal, '150 g de patinho', 0),
    (v_meal, '100 g de arroz branco', 1),
    (v_meal, 'Salada verde à vontade', 2),
    (v_meal, 'Suco de 1 limão', 3);

  insert into meals (plan_id, slot, label, serve_at, title, kcal, protein_g, carb_g, fat_g, swappable, position)
  values (v_nut_plan, 'pre_treino', 'Pré-treino', '16:00', 'Pão integral com pasta de amendoim', 360, 14, 44, 14, true, 2)
  returning id into v_meal;
  insert into meal_items (meal_id, description, position) values
    (v_meal, '2 fatias de pão integral', 0),
    (v_meal, '20 g de pasta de amendoim', 1);

  insert into meals (plan_id, slot, label, serve_at, title, kcal, protein_g, carb_g, fat_g, swappable, position)
  values (v_nut_plan, 'pos_treino', 'Pós-treino', '19:30', 'Frango, batata doce e legumes', 560, 45, 62, 10, false, 3)
  returning id into v_meal;
  insert into meal_items (meal_id, description, position) values
    (v_meal, '180 g de frango', 0),
    (v_meal, '200 g de batata doce', 1),
    (v_meal, 'Brócolis no vapor', 2);

  insert into meals (plan_id, slot, label, serve_at, title, kcal, protein_g, carb_g, fat_g, swappable, position)
  values (v_nut_plan, 'ceia', 'Ceia', '22:00', 'Iogurte com whey', 340, 39, 18, 12, false, 4)
  returning id into v_meal;
  insert into meal_items (meal_id, description, position) values
    (v_meal, '200 g de iogurte natural', 0),
    (v_meal, '1 scoop de whey', 1),
    (v_meal, 'Canela', 2);

  --------------------------------------------------------------- TREINO ----

  delete from workout_plans where patient_id = v_patient;

  insert into workout_plans (patient_id, title, split, week_number, total_weeks, created_by)
  values (v_patient, 'Hipertrofia ondulatória', 'ABCD', 9, 12, v_pro)
  returning id into v_wrk_plan;

  insert into workouts (plan_id, letter, title, focus, est_minutes, weekday, position)
  values (v_wrk_plan, 'A', 'Membros inferiores', 'Quadríceps e panturrilha', 50, 1, 0)
  returning id into v_workout_a;

  insert into exercises (workout_id, name, muscle, target_sets, target_reps, target_load, rest_text, note, position) values
    (v_workout_a, 'Agachamento livre',  'Quadríceps',  4, '6-8',   '80 kg',  '2 min', 'Subir a carga se fechar 8 repetições com folga.', 0),
    (v_workout_a, 'Leg press 45°',      'Quadríceps',  4, '10-12', '210 kg', '90 s',  null, 1),
    (v_workout_a, 'Cadeira extensora',  'Quadríceps',  3, '12-15', '45 kg',  '60 s',  null, 2),
    (v_workout_a, 'Stiff',              'Posterior',   3, '10',    '60 kg',  '90 s',  null, 3),
    (v_workout_a, 'Panturrilha em pé',  'Panturrilha', 4, '15-20', '70 kg',  '45 s',  null, 4);

  insert into workouts (plan_id, letter, title, focus, est_minutes, weekday, position)
  values (v_wrk_plan, 'B', 'Peito e tríceps', 'Empurrar', 55, 2, 1)
  returning id into v_workout_b;

  insert into exercises (workout_id, name, muscle, target_sets, target_reps, target_load, rest_text, note, position) values
    (v_workout_b, 'Supino reto',                'Peito',   5, '5',     '90 kg',    '2 min', 'Bloco pesado da periodização.', 0),
    (v_workout_b, 'Supino inclinado halteres',  'Peito',   4, '8-10',  '30 kg',    '90 s',  null, 1),
    (v_workout_b, 'Paralelas',                  'Tríceps', 3, '10-12', 'Corporal', '60 s',  null, 2),
    (v_workout_b, 'Tríceps corda',              'Tríceps', 3, '12-15', '35 kg',    '45 s',  null, 3);

  insert into workouts (plan_id, letter, title, focus, est_minutes, weekday, position) values
    (v_wrk_plan, 'C', 'Costas e bíceps', 'Puxar',        55, 4, 2),
    (v_wrk_plan, 'D', 'Ombros e core',   'Estabilidade', 45, 5, 3);

  ------------------------------------------------------------- MÉTRICAS ----

  delete from body_metrics where patient_id = v_patient;

  insert into body_metrics (patient_id, measured_on, weight_kg, body_fat_pct, lean_mass_kg, waist_cm)
  select
    v_patient,
    current_date - (n * 7),
    76.8 - (11 - n) * 0.21,
    16.0 - (11 - n) * 0.16,
    62.9 + (11 - n) * 0.09,
    82 - (11 - n) * 0.27
  from generate_series(0, 11) as n;

  ------------------------------------------------------------- CHECK-INS ---

  delete from checkins where patient_id = v_patient;

  insert into checkins (patient_id, week_start, weight_kg, sleep_hours, energy, hunger, pain, adherence)
  select
    v_patient,
    date_trunc('week', current_date)::date - (n * 7),
    76.8 - (7 - n) * 0.3,
    6.0 + (n * 0.1),
    3 + (n % 3),
    3,
    1,
    least(5, greatest(3, 3 + (n % 3)))
  from generate_series(0, 7) as n;

  ---------------------------------------------------------- HIDRATAÇÃO ----

  delete from hydration_logs where patient_id = v_patient;

  insert into hydration_logs (patient_id, logged_on, amount_ml) values
    (v_patient, current_date, 500),
    (v_patient, current_date, 350),
    (v_patient, current_date, 250),
    (v_patient, current_date, 400);

  --------------------------------------------------------------- EXAMES ----

  delete from exams where patient_id = v_patient;

  insert into exams (patient_id, collected_on, lab)
  values (v_patient, current_date - 14, 'Laboratório Fleury')
  returning id into v_exam;

  insert into exam_markers (exam_id, name, value_text, value_num, unit, ref_range, status, delta_text, position) values
    (v_exam, 'Ferritina',    '32 ng/mL',   32,  'ng/mL',  '30 – 400',      'atencao',  '-18', 0),
    (v_exam, 'Vitamina D',   '41 ng/mL',   41,  'ng/mL',  '30 – 100',      'ok',       '+9',  1),
    (v_exam, 'TSH',          '2,1 µUI/mL', 2.1, 'µUI/mL', '0,4 – 4,0',     'ok',       '0',   2),
    (v_exam, 'Testosterona', '612 ng/dL',  612, 'ng/dL',  '250 – 1100',    'ok',       '+48', 3),
    (v_exam, 'LDL',          '142 mg/dL',  142, 'mg/dL',  'abaixo de 130', 'alterado', '+12', 4),
    (v_exam, 'Creatinina',   '1,1 mg/dL',  1.1, 'mg/dL',  '0,7 – 1,3',     'ok',       '0',   5);

  ----------------------------------------------------------- PROTOCOLOS ----

  delete from protocols where professional_id = v_pro;

  insert into protocols (professional_id, title, kind, ai_enabled, uses) values
    (v_pro, 'Hipertrofia limpa (masculino)',    'nutricao', true,  342),
    (v_pro, 'Emagrecimento acelerado',          'nutricao', true,  512),
    (v_pro, 'Adaptação anatômica (iniciantes)', 'treino',   false, 89),
    (v_pro, 'Força máxima (avançado)',          'treino',   true,  45),
    (v_pro, 'Check-up hormonal completo',       'exames',   false, 120),
    (v_pro, 'Dieta anti-inflamatória',          'nutricao', true,  210);

  ------------------------------------------------------------ REVISÃO IA ---

  delete from ai_reviews where patient_id = v_patient;

  insert into ai_reviews (
    patient_id, professional_id, module, urgency, confidence,
    trigger_text, summary, rationale, action, sources, before_state, after_state
  ) values (
    v_patient, v_pro, 'nutricao', 'alta', 94,
    'Queda de ferritina detectada em exame',
    'Aumento de 200 kcal e troca da proteína do almoço.',
    'Paciente relatou fadiga extrema no treino B. O exame de sangue aponta queda de ferritina (32 ng/mL) e leve depleção de glicogênio muscular.',
    'Superávit estratégico de +200 kcal com fonte de ferro biodisponível na janela do almoço, associado a vitamina C para potencializar a absorção.',
    array['Check-in semanal', 'Exame de sangue', 'Log de treino'],
    '{"title":"Protocolo atual","lines":["150 g de frango grelhado","100 g de arroz branco","Salada verde"],"kcal":420,"macros":"35 P · 45 C · 5 G"}'::jsonb,
    '{"title":"Proposta da IA","lines":["150 g de patinho bovino","100 g de arroz branco","Salada verde","Suco de 1 limão (vit. C)"],"kcal":620,"macros":"38 P · 48 C · 12 G"}'::jsonb
  ), (
    v_patient, v_pro, 'treino', 'media', 88,
    'Fim de ciclo (mês 3) com estagnação de carga',
    'Nova periodização com ondulação de intensidade.',
    'As cargas dos principais exercícios não progridem há 3 semanas e a PSE média subiu de 7 para 8,6 — sinal clássico de platô por acúmulo de fadiga.',
    'Trocar o bloco linear por ondulação diária, reduzindo o volume em 20% na primeira semana (deload) e retomando com séries de 5 repetições pesadas.',
    array['Log de treino', 'PSE semanal'],
    '{"title":"Protocolo atual","lines":["Supino reto 4 × 8-10","Remada curvada 4 × 8-10","Volume: 22 séries"],"kcal":0,"macros":"Linear · 3 meses"}'::jsonb,
    '{"title":"Proposta da IA","lines":["Supino reto 5 × 5 (pesado)","Remada curvada 4 × 6-8","Volume: 18 séries (deload)"],"kcal":0,"macros":"Ondulatório · 8 semanas"}'::jsonb
  ), (
    v_patient, v_pro, 'suplementacao', 'alta', 97,
    'LDL acima do alvo no último exame',
    'Introduzir ômega-3 e revisar gorduras da dieta.',
    'LDL em 142 mg/dL com histórico familiar de dislipidemia registrado na anamnese.',
    'Iniciar ômega-3 2 g/dia (EPA+DHA) e substituir parte das gorduras saturadas por mono-insaturadas, reavaliando em 90 dias.',
    array['Exame de sangue', 'Anamnese'],
    '{"title":"Protocolo atual","lines":["Sem suplementação lipídica"],"kcal":0,"macros":"0 itens ativos"}'::jsonb,
    '{"title":"Proposta da IA","lines":["Ômega-3 2 g/dia (EPA+DHA)","Azeite extravirgem no almoço","Reduzir queijos amarelos"],"kcal":0,"macros":"1 item ativo"}'::jsonb
  );

  ------------------------------------------------------------ FATURAMENTO --

  delete from transactions   where patient_id = v_patient;
  delete from subscriptions  where patient_id = v_patient;

  insert into subscriptions (patient_id, tier, amount_cents, started_on, next_charge_on)
  values (v_patient, 'completo', 14990, current_date - 150, current_date + 12)
  returning id into v_sub;

  insert into transactions (patient_id, subscription_id, amount_cents, status, occurred_at)
  select
    v_patient,
    v_sub,
    14990,
    case when n = 0 then 'pendente'::payment_status else 'pago'::payment_status end,
    (current_date - (n * 30))::timestamptz
  from generate_series(0, 5) as n;

  ------------------------------------------------------------- MENSAGENS ---
  -- Inserção direta em vez de `ensure_conversation()`: no SQL Editor não há
  -- `auth.uid()`, e a função exige que o chamador seja um dos participantes.

  insert into conversations (patient_id, professional_id)
  values (v_patient, v_pro)
  on conflict (patient_id, professional_id) do nothing;

  insert into messages (conversation_id, sender_id, sender_kind, body, created_at)
  select c.id, v_pro, 'profissional',
         'Bem-vindo ao Ryse! Seu plano já está montado. Qualquer dúvida, é só chamar por aqui.',
         now() - interval '2 hours'
    from conversations c
   where c.patient_id = v_patient and c.professional_id = v_pro
     and not exists (select 1 from messages m where m.conversation_id = c.id);

  raise notice 'Seed concluído. Profissional: %  |  Paciente: %', v_pro_email, v_patient_email;
end $$;

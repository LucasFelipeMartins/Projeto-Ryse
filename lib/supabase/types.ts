/**
 * Tipos do banco do Ryse.
 *
 * Espelham `supabase/migrations/*.sql`. Depois de qualquer alteração no schema,
 * regenere com:
 *
 *   npx supabase gen types typescript --project-id SEU_ID > lib/supabase/types.ts
 *
 * Enquanto o projeto não estiver linkado, este arquivo é a fonte de verdade —
 * mantenha-o em sincronia com as migrations.
 */

/**
 * Molda uma tabela no formato que o supabase-js espera.
 *
 * `Rels` descreve as chaves estrangeiras da tabela. É o que permite tipar
 * selects aninhados (`meals(*, meal_items(*))`) — sem isso o PostgREST
 * devolve SelectQueryError em vez do tipo da relação.
 */
type Rel<Name extends string, Col extends string, Ref extends string> = {
  foreignKeyName: Name;
  columns: [Col];
  isOneToOne: false;
  referencedRelation: Ref;
  referencedColumns: ['id'];
};

type Table<
  Row,
  RequiredOnInsert extends keyof Row = never,
  Rels extends readonly unknown[] = [],
> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, RequiredOnInsert>;
  Update: Partial<Row>;
  Relationships: Rels;
};

export type UserRole = 'paciente' | 'profissional';
export type PlanTier = 'completo' | 'nutricao' | 'treino';
export type MealSlot =
  | 'cafe'
  | 'lanche_manha'
  | 'almoco'
  | 'pre_treino'
  | 'pos_treino'
  | 'jantar'
  | 'ceia';
export type ProtocolKind = 'nutricao' | 'treino' | 'exames';
export type ReviewModule = 'nutricao' | 'treino' | 'suplementacao';
export type ReviewUrgency = 'alta' | 'media';
export type ReviewStatus = 'pendente' | 'aprovado' | 'editado' | 'rejeitado';
export type MarkerStatus = 'ok' | 'atencao' | 'alterado';
export type SenderKind = 'paciente' | 'profissional' | 'ia';
export type PaymentStatus = 'pago' | 'pendente' | 'falhou' | 'estornado';
export type DocumentStatus =
  | 'validando'
  | 'rejeitado'
  | 'aguardando_analise'
  | 'analisado'
  | 'erro';
export type AiPriority = 'baixa' | 'media' | 'alta';
export type AiDetailLevel = 'resumido' | 'padrao' | 'completo';
export type AiRequestKind =
  | 'dieta'
  | 'ficha_treino'
  | 'relatorio_nutricao'
  | 'relatorio_treino'
  | 'relatorio_saude'
  | 'relatorio_exames'
  | 'analise_protocolo';
export type AiRequestStatus = 'reservado' | 'concluido' | 'falhou';
export type AiOutputKind = AiRequestKind;
export type NotificationCategory =
  | 'geral'
  | 'treino'
  | 'hidratacao'
  | 'checkin'
  | 'relatorio'
  | 'mensagem';
export type Sex = 'feminino' | 'masculino' | 'outro';
export type ActivityLevel = 'sedentario' | 'leve' | 'moderado' | 'intenso' | 'atleta';
export type TrainingLevel = 'iniciante' | 'intermediario' | 'avancado';
export type DocumentKind =
  | 'exame_laboratorial'
  | 'laudo_imagem'
  | 'receita'
  | 'atestado'
  | 'outro_saude'
  | 'nao_relacionado';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/* ------------------------------------------------------------------- ROWS */

export type ProfileRow = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  phone: string | null;
  birth_date: string | null;
  height_cm: number | null;
  goal: string | null;
  plan: PlanTier | null;
  professional_id: string | null;
  water_goal_ml: number;
  kcal_goal: number | null;
  steps_goal: number;
  crm: string | null;
  specialty: string | null;
  onboarded_at: string | null;
  chose_solo_at: string | null;
  sex: Sex | null;
  activity_level: ActivityLevel | null;
  training_level: TrainingLevel | null;
  training_days: number | null;
  routine: string | null;
  food_preferences: string[];
  food_restrictions: string[];
  health_notes: string | null;
  timezone: string;
  water_goal_override_ml: number | null;
  created_at: string;
  updated_at: string;
};

export type BodyMetricRow = {
  id: string;
  patient_id: string;
  measured_on: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  lean_mass_kg: number | null;
  waist_cm: number | null;
  created_at: string;
};

export type HydrationLogRow = {
  id: string;
  patient_id: string;
  logged_on: string;
  amount_ml: number;
  logged_at: string;
};

export type NutritionPlanRow = {
  id: string;
  patient_id: string;
  title: string;
  kcal_target: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
};

export type MealRow = {
  id: string;
  plan_id: string;
  slot: MealSlot;
  label: string;
  serve_at: string;
  title: string;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  swappable: boolean;
  position: number;
};

export type MealItemRow = {
  id: string;
  meal_id: string;
  description: string;
  position: number;
};

export type MealLogRow = {
  id: string;
  patient_id: string;
  meal_id: string;
  logged_on: string;
  created_at: string;
};

export type WorkoutPlanRow = {
  id: string;
  patient_id: string;
  title: string;
  split: string | null;
  week_number: number;
  total_weeks: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
};

export type WorkoutRow = {
  id: string;
  plan_id: string;
  letter: string;
  title: string;
  focus: string;
  est_minutes: number;
  weekday: number | null;
  position: number;
};

export type ExerciseRow = {
  id: string;
  workout_id: string;
  name: string;
  muscle: string;
  target_sets: number;
  target_reps: string;
  target_load: string | null;
  rest_text: string | null;
  note: string | null;
  position: number;
};

export type WorkoutSessionRow = {
  id: string;
  patient_id: string;
  workout_id: string;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  rpe: number | null;
  notes: string | null;
};

export type SetLogRow = {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  load_kg: number | null;
  reps: number | null;
  done: boolean;
};

export type CheckinRow = {
  id: string;
  patient_id: string;
  week_start: string;
  weight_kg: number | null;
  sleep_hours: number | null;
  energy: number | null;
  hunger: number | null;
  pain: number | null;
  adherence: number | null;
  notes: string | null;
  created_at: string;
};

export type ExamRow = {
  id: string;
  patient_id: string;
  collected_on: string;
  lab: string | null;
  file_path: string | null;
  created_at: string;
};

export type ExamMarkerRow = {
  id: string;
  exam_id: string;
  name: string;
  value_text: string;
  value_num: number | null;
  unit: string | null;
  ref_range: string | null;
  status: MarkerStatus;
  delta_text: string | null;
  position: number;
};

export type ProtocolRow = {
  id: string;
  professional_id: string;
  title: string;
  kind: ProtocolKind;
  ai_enabled: boolean;
  uses: number;
  body: Json;
  created_at: string;
};

export type AiReviewRow = {
  id: string;
  patient_id: string;
  professional_id: string;
  module: ReviewModule;
  urgency: ReviewUrgency;
  confidence: number;
  trigger_text: string;
  summary: string;
  rationale: string;
  action: string;
  sources: string[];
  before_state: Json;
  after_state: Json;
  status: ReviewStatus;
  decision_note: string | null;
  decided_at: string | null;
  decided_by: string | null;
  created_at: string;
};

export type ConversationRow = {
  id: string;
  patient_id: string;
  professional_id: string;
  last_message_at: string;
  created_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  sender_kind: SenderKind;
  body: string;
  read_at: string | null;
  created_at: string;
};

export type SubscriptionRow = {
  id: string;
  patient_id: string;
  tier: PlanTier;
  amount_cents: number;
  is_active: boolean;
  started_on: string;
  next_charge_on: string | null;
  created_at: string;
};

export type TransactionRow = {
  id: string;
  patient_id: string;
  subscription_id: string | null;
  amount_cents: number;
  status: PaymentStatus;
  occurred_at: string;
};

export type HealthDocumentRow = {
  id: string;
  patient_id: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  page_count: number | null;
  status: DocumentStatus;
  kind: DocumentKind | null;
  reject_reason: string | null;
  provider: string | null;
  summary: string | null;
  collected_on: string | null;
  lab: string | null;
  markers: Json;
  highlights: string[];
  content_score: number | null;
  consent_at: string | null;
  analyzed_at: string | null;
  created_at: string;
};

export type NotificationPrefRow = {
  profile_id: string;
  protocol_changes: boolean;
  workout_reminder: boolean;
  exam_results: boolean;
  general_enabled: boolean;
  hydration_reminder: boolean;
  checkin_reminder: boolean;
  reports: boolean;
  messages: boolean;
  quiet_from: string;
  quiet_to: string;
  updated_at: string;
};

export type AiProtocolRow = {
  id: string;
  patient_id: string;
  professional_id: string;
  objective: string;
  priority: AiPriority;
  scopes: string[];
  detail_level: AiDetailLevel;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AiUsageRow = {
  id: string;
  profile_id: string;
  patient_id: string;
  kind: AiRequestKind;
  period_key: string;
  status: AiRequestStatus;
  output_id: string | null;
  error_text: string | null;
  requested_at: string;
  finished_at: string | null;
};

export type AiOutputRow = {
  id: string;
  patient_id: string;
  created_by: string | null;
  kind: AiOutputKind;
  title: string;
  content: Json;
  model: string | null;
  created_at: string;
};

export type PushSubscriptionRow = {
  id: string;
  profile_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
  expired_at: string | null;
};

export type NotificationRow = {
  id: string;
  profile_id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  url: string | null;
  scheduled_for: string;
  sent_at: string | null;
  read_at: string | null;
  skip_reason: string | null;
  created_at: string;
};

/* --------------------------------------------------------------- DATABASE */

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, 'id' | 'email' | 'full_name'>;
      body_metrics: Table<BodyMetricRow, 'patient_id'>;
      hydration_logs: Table<HydrationLogRow, 'patient_id' | 'amount_ml'>;
      nutrition_plans: Table<NutritionPlanRow, 'patient_id' | 'title' | 'kcal_target'>;
      meals: Table<
        MealRow,
        'plan_id' | 'slot' | 'label' | 'serve_at' | 'title',
        [Rel<'meals_plan_id_fkey', 'plan_id', 'nutrition_plans'>]
      >;
      meal_items: Table<
        MealItemRow,
        'meal_id' | 'description',
        [Rel<'meal_items_meal_id_fkey', 'meal_id', 'meals'>]
      >;
      meal_logs: Table<MealLogRow, 'patient_id' | 'meal_id'>;
      workout_plans: Table<WorkoutPlanRow, 'patient_id' | 'title'>;
      workouts: Table<
        WorkoutRow,
        'plan_id' | 'letter' | 'title' | 'focus',
        [Rel<'workouts_plan_id_fkey', 'plan_id', 'workout_plans'>]
      >;
      exercises: Table<
        ExerciseRow,
        'workout_id' | 'name' | 'muscle',
        [Rel<'exercises_workout_id_fkey', 'workout_id', 'workouts'>]
      >;
      workout_sessions: Table<WorkoutSessionRow, 'patient_id' | 'workout_id'>;
      set_logs: Table<SetLogRow, 'session_id' | 'exercise_id' | 'set_number'>;
      checkins: Table<CheckinRow, 'patient_id' | 'week_start'>;
      exams: Table<ExamRow, 'patient_id' | 'collected_on'>;
      exam_markers: Table<
        ExamMarkerRow,
        'exam_id' | 'name' | 'value_text',
        [Rel<'exam_markers_exam_id_fkey', 'exam_id', 'exams'>]
      >;
      protocols: Table<ProtocolRow, 'professional_id' | 'title' | 'kind'>;
      ai_reviews: Table<
        AiReviewRow,
        | 'patient_id'
        | 'professional_id'
        | 'module'
        | 'confidence'
        | 'trigger_text'
        | 'summary'
        | 'rationale'
        | 'action',
        [
          Rel<'ai_reviews_patient_id_fkey', 'patient_id', 'profiles'>,
          Rel<'ai_reviews_professional_id_fkey', 'professional_id', 'profiles'>,
        ]
      >;
      conversations: Table<
        ConversationRow,
        'patient_id' | 'professional_id',
        [
          Rel<'conversations_patient_id_fkey', 'patient_id', 'profiles'>,
          Rel<'conversations_professional_id_fkey', 'professional_id', 'profiles'>,
        ]
      >;
      messages: Table<
        MessageRow,
        'conversation_id' | 'sender_kind' | 'body',
        [Rel<'messages_conversation_id_fkey', 'conversation_id', 'conversations'>]
      >;
      subscriptions: Table<SubscriptionRow, 'patient_id' | 'tier' | 'amount_cents'>;
      transactions: Table<TransactionRow, 'patient_id' | 'amount_cents'>;
      notification_prefs: Table<NotificationPrefRow, 'profile_id'>;
      health_documents: Table<
        HealthDocumentRow,
        'patient_id' | 'storage_path' | 'original_name' | 'mime_type' | 'size_bytes'
      >;
      ai_protocols: Table<
        AiProtocolRow,
        'patient_id' | 'professional_id' | 'objective',
        [
          Rel<'ai_protocols_patient_id_fkey', 'patient_id', 'profiles'>,
          Rel<'ai_protocols_professional_id_fkey', 'professional_id', 'profiles'>,
        ]
      >;
      ai_usage: Table<AiUsageRow, 'profile_id' | 'patient_id' | 'kind' | 'period_key'>;
      ai_outputs: Table<AiOutputRow, 'patient_id' | 'kind' | 'title'>;
      push_subscriptions: Table<
        PushSubscriptionRow,
        'profile_id' | 'endpoint' | 'p256dh' | 'auth'
      >;
      notifications: Table<NotificationRow, 'profile_id' | 'category' | 'title' | 'body'>;
    };
    Views: Record<never, never>;
    Functions: {
      hydration_total_ml: {
        Args: { target_patient: string; target_day: string };
        Returns: number;
      };
      weekly_adherence: {
        Args: { target_patient: string; weeks?: number };
        Returns: { week_start: string; adherence: number }[];
      };
      ensure_conversation: {
        Args: { target_patient: string };
        Returns: string;
      };
      documents_this_week: {
        Args: { target_patient: string };
        Returns: number;
      };
      latest_weight_kg: {
        Args: { target_patient: string };
        Returns: number | null;
      };
      current_week_start: {
        Args: { target_profile: string };
        Returns: string;
      };
      checkin_pending: {
        Args: { target_patient: string };
        Returns: boolean;
      };
      release_ai_reservation: {
        Args: { reservation: string };
        Returns: void;
      };
      complete_ai_reservation: {
        Args: { reservation: string; output: string | null };
        Returns: void;
      };
      list_professionals: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          full_name: string;
          specialty: string | null;
          crm: string | null;
          patient_count: number;
        }[];
      };
    };
    Enums: {
      user_role: UserRole;
      plan_tier: PlanTier;
      meal_slot: MealSlot;
      protocol_kind: ProtocolKind;
      review_module: ReviewModule;
      review_urgency: ReviewUrgency;
      review_status: ReviewStatus;
      marker_status: MarkerStatus;
      sender_kind: SenderKind;
      payment_status: PaymentStatus;
      document_status: DocumentStatus;
      document_kind: DocumentKind;
      ai_priority: AiPriority;
      ai_detail_level: AiDetailLevel;
      ai_request_kind: AiRequestKind;
      ai_request_status: AiRequestStatus;
      ai_output_kind: AiOutputKind;
      notification_category: NotificationCategory;
    };
    CompositeTypes: Record<never, never>;
  };
};

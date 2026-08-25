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

export type NotificationPrefRow = {
  profile_id: string;
  protocol_changes: boolean;
  workout_reminder: boolean;
  exam_results: boolean;
  updated_at: string;
};

/* --------------------------------------------------------------- DATABASE */

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, 'id' | 'email' | 'full_name'>;
      body_metrics: Table<BodyMetricRow, 'patient_id'>;
      hydration_logs: Table<HydrationLogRow, 'patient_id' | 'amount_ml'>;
      nutrition_plans: Table<NutritionPlanRow, 'patient_id' | 'title' | 'kcal_target'>;
      meals: Table<MealRow, 'plan_id' | 'slot' | 'label' | 'serve_at' | 'title'>;
      meal_items: Table<
        MealItemRow,
        'meal_id' | 'description',
        [Rel<'meal_items_meal_id_fkey', 'meal_id', 'meals'>]
      >;
      meal_logs: Table<MealLogRow, 'patient_id' | 'meal_id'>;
      workout_plans: Table<WorkoutPlanRow, 'patient_id' | 'title'>;
      workouts: Table<WorkoutRow, 'plan_id' | 'letter' | 'title' | 'focus'>;
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
    };
    CompositeTypes: Record<never, never>;
  };
};

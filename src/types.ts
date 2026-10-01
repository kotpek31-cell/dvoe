// Типы строк базы данных (совпадают с supabase/schema.sql)

export type ChibiKind = 'boy' | 'girl' | 'nb';

// Внешность чибика (profiles.chibi). 0.1.1 пишет только kind; с 0.2 — образ из вещей (v: 2),
// разбирает его lookOf в src/lib/chibi.ts.
export type ChibiSlot = { id: string; c?: string };
export type ChibiLook = {
  kind?: ChibiKind;
  v?: number;
  skin?: number;
  hair?: ChibiSlot | null;
  eyes?: ChibiSlot | null;
  hat?: ChibiSlot | null;
  face?: ChibiSlot | null;
  top?: ChibiSlot | null;
  bottom?: ChibiSlot | null;
  shoes?: ChibiSlot | null;
  back?: ChibiSlot | null;
  hand?: ChibiSlot | null;
  ability?: string;
};

export type Profile = {
  id: string;
  display_name: string;
  avatar_emoji: string;
  pair_id: string | null;
  water_goal: number;
  sleeping_since: string | null;
  chibi?: ChibiLook | null;
  created_at: string;
};

export type Pair = {
  id: string;
  invite_code: string;
  created_by: string;
  created_at: string;
};

export type MoodEntry = {
  id: string;
  user_id: string;
  day: string;
  emotion: string; // главная эмоция (для старых версий приложения и виджета)
  sub_emotion: string | null;
  intensity: number; // 1…5, главная эмоция
  emotions?: Record<string, number> | null; // с 0.1: сила каждой эмоции 0…100
  note: string | null;
  created_at: string;
};

export type SleepSource = 'android_screen' | 'healthkit' | 'manual' | 'buttons';

export type SleepEntry = {
  id: string;
  user_id: string;
  day: string;
  bed_time: string;
  wake_time: string;
  duration_min: number;
  source: SleepSource;
  created_at: string;
  updated_at: string;
};

export type Gratitude = {
  id: string;
  user_id: string;
  day: string;
  text: string;
  created_at: string;
};

export type WishHorizon = 'today' | 'future';

export type Wish = {
  id: string;
  user_id: string;
  day: string;
  title: string;
  note: string | null;
  horizon: WishHorizon;
  is_done: boolean;
  done_by: string | null;
  done_at: string | null;
  created_at: string;
};

export type DayScore = {
  user_id: string;
  day: string;
  rating: number;
  auto_score: number | null;
  note: string | null;
  updated_at: string;
};

export type AnswerMark = { user_id: string; day: string };

export type QuestionAnswerRow = {
  id: string;
  user_id: string;
  day: string;
  question_id: number;
  answer: string;
  created_at: string;
  questions: { text: string } | null;
};

export type DailyQuestion = {
  question_id: number;
  text: string;
  my_answer: string | null;
  partner_answered: boolean;
  partner_answer: string | null;
};

export type Nudge = { id: string; from_user: string; created_at: string };

export type Streak = { user_id: string; streak: number; filled_today: boolean };

export type TableName =
  | 'profiles'
  | 'mood_entries'
  | 'sleep_entries'
  | 'gratitudes'
  | 'wishes'
  | 'question_answers'
  | 'day_scores'
  | 'nudges';

export const REALTIME_TABLES: TableName[] = [
  'profiles',
  'mood_entries',
  'sleep_entries',
  'gratitudes',
  'wishes',
  'question_answers',
  'day_scores',
  'nudges',
];

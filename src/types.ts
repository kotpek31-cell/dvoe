// Типы строк базы данных (совпадают с supabase/schema.sql)

export type Profile = {
  id: string;
  display_name: string;
  avatar_emoji: string;
  pair_id: string | null;
  water_goal: number;
  sleeping_since: string | null;
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
  emotion: string;
  sub_emotion: string | null;
  intensity: number;
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

export type WaterLog = { user_id: string; day: string; glasses: number };

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
  | 'water_logs'
  | 'gratitudes'
  | 'wishes'
  | 'question_answers'
  | 'day_scores'
  | 'nudges';

export const REALTIME_TABLES: TableName[] = [
  'profiles',
  'mood_entries',
  'sleep_entries',
  'water_logs',
  'gratitudes',
  'wishes',
  'question_answers',
  'day_scores',
  'nudges',
];

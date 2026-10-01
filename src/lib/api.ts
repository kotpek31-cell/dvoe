// Все обращения к базе данных. Каждая функция либо возвращает данные,
// либо бросает Error с понятным русским текстом.
import type {
  AnswerMark,
  DailyQuestion,
  DayScore,
  Gratitude,
  MoodEntry,
  Nudge,
  Pair,
  Profile,
  QuestionAnswerRow,
  SleepEntry,
  SleepSource,
  Streak,
  Wish,
  WishHorizon,
  ChibiLook,
} from '../types';
import { atTime } from './dates';
import { legacyIntensity, mixDominant, type MoodMix } from './emotions';
import type { RangeData } from './report';
import { supabase } from './supabase';

type PgError = { message: string; code?: string } | null;

export function translateError(message: string): string {
  if (/network request failed|failed to fetch|fetch failed|timeout|aborted/i.test(message)) {
    return 'Нет связи с сервером. Проверьте интернет. В России Supabase может требовать VPN или прокси — см. README.';
  }
  if (/jwt expired|invalid jwt|refresh token/i.test(message)) return 'Сессия устарела — войдите заново.';
  if (/row-level security/i.test(message)) return 'Нет доступа: запись не относится к вашей паре.';
  if (/permission denied/i.test(message)) return 'Нет прав на действие. Убедитесь, что SQL-схема выполнена полностью.';
  if (/duplicate key/i.test(message)) return 'Такая запись уже есть.';
  if (/schema cache|does not exist|could not find the (function|column)/i.test(message)) {
    return 'База данных ещё не обновлена до 0.1: выполните supabase/schema.sql в Supabase → SQL Editor.';
  }
  return message;
}

function check(error: PgError): void {
  if (error) throw new Error(translateError(error.message));
}

// ---------- Профиль и пара ----------

export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*');
  check(error);
  return (data ?? []) as Profile[];
}

export async function fetchPair(): Promise<Pair | null> {
  const { data, error } = await supabase.from('pairs').select('*').maybeSingle();
  check(error);
  return (data as Pair | null) ?? null;
}

export async function createPair(): Promise<Pair> {
  const { data, error } = await supabase.rpc('create_pair');
  check(error);
  return data as Pair;
}

export async function joinPair(code: string): Promise<Pair> {
  const { data, error } = await supabase.rpc('join_pair', { p_code: code });
  check(error);
  return data as Pair;
}

export async function leavePair(): Promise<void> {
  const { error } = await supabase.rpc('leave_pair');
  check(error);
}

export type ProfilePatch = Partial<Pick<Profile, 'display_name' | 'avatar_emoji' | 'sleeping_since'>> & { chibi?: ChibiLook };

export async function updateMyProfile(userId: string, patch: ProfilePatch): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  check(error);
}

export async function savePushToken(userId: string, token: string | null): Promise<void> {
  const { error } = await supabase
    .from('user_private')
    .upsert({ user_id: userId, expo_push_token: token, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  check(error);
}

// ---------- Чтение данных за период ----------

export async function fetchRange(from: string, to: string): Promise<RangeData> {
  const [moods, sleeps, gratitudes, scores, answers, wishesDone] = await Promise.all([
    supabase.from('mood_entries').select('*').gte('day', from).lte('day', to).order('created_at'),
    supabase.from('sleep_entries').select('*').gte('day', from).lte('day', to).order('day'),
    supabase.from('gratitudes').select('*').gte('day', from).lte('day', to).order('created_at'),
    supabase.from('day_scores').select('*').gte('day', from).lte('day', to),
    supabase.rpc('answered_days', { p_from: from, p_to: to }),
    supabase
      .from('wishes')
      .select('*')
      .eq('is_done', true)
      .gte('done_at', atTime(from, 0).toISOString())
      .lt('done_at', new Date(atTime(to, 0).getTime() + 86_400_000).toISOString()),
  ]);
  for (const res of [moods, sleeps, gratitudes, scores, answers, wishesDone]) check(res.error);
  return {
    moods: (moods.data ?? []) as MoodEntry[],
    sleeps: (sleeps.data ?? []) as SleepEntry[],
    gratitudes: (gratitudes.data ?? []) as Gratitude[],
    scores: (scores.data ?? []) as DayScore[],
    answers: (answers.data ?? []) as AnswerMark[],
    wishesDone: (wishesDone.data ?? []) as Wish[],
  };
}

export async function fetchDailyQuestion(day: string): Promise<DailyQuestion | null> {
  const { data, error } = await supabase.rpc('daily_question', { p_day: day });
  check(error);
  return (data as DailyQuestion | null) ?? null;
}

export async function answerQuestion(day: string, questionId: number, answer: string): Promise<void> {
  const { error } = await supabase.from('question_answers').insert({ day, question_id: questionId, answer: answer.trim() });
  check(error);
}

export async function fetchAnswerArchive(): Promise<QuestionAnswerRow[]> {
  const { data, error } = await supabase
    .from('question_answers')
    .select('id, user_id, day, question_id, answer, created_at, questions(text)')
    .order('day', { ascending: false })
    .limit(200);
  check(error);
  return (data ?? []) as unknown as QuestionAnswerRow[];
}

export async function fetchStreaks(day: string): Promise<Streak[]> {
  const { data, error } = await supabase.rpc('pair_streaks', { p_today: day });
  check(error);
  return (data ?? []) as Streak[];
}

export async function fetchNudgesSince(sinceIso: string): Promise<Nudge[]> {
  const { data, error } = await supabase
    .from('nudges')
    .select('id, from_user, created_at')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false });
  check(error);
  return (data ?? []) as Nudge[];
}

// ---------- Запись ----------

export async function fetchMoods(from: string, to: string): Promise<MoodEntry[]> {
  const { data, error } = await supabase
    .from('mood_entries')
    .select('*')
    .gte('day', from)
    .lte('day', to)
    .order('created_at', { ascending: false });
  check(error);
  return (data ?? []) as MoodEntry[];
}

// Отметка настроения — смесь эмоций 0…100. В старые колонки emotion/intensity кладём главную эмоцию,
// чтобы старые версии приложения и виджет тоже её видели.
export async function addMood(input: { day: string; mix: MoodMix; subs: string[]; note: string | null }): Promise<void> {
  const dominant = mixDominant(input.mix);
  if (!dominant) throw new Error('Подвинь хотя бы один ползунок');
  const emotions: Record<string, number> = {};
  (Object.keys(input.mix) as (keyof MoodMix)[]).forEach((key) => {
    const v = Math.round(input.mix[key] ?? 0);
    if (v > 0) emotions[key] = Math.min(100, v);
  });
  const { error } = await supabase.from('mood_entries').insert({
    day: input.day,
    emotion: dominant.key,
    intensity: legacyIntensity(dominant.value),
    emotions,
    sub_emotion: input.subs.length ? input.subs.join(', ').slice(0, 200) : null,
    note: input.note?.trim() || null,
  });
  check(error);
}

export async function deleteMood(id: string): Promise<void> {
  const { error } = await supabase.from('mood_entries').delete().eq('id', id);
  check(error);
}

export async function upsertSleep(input: {
  userId: string;
  day: string;
  bed: Date;
  wake: Date;
  durationMin: number;
  source: SleepSource;
}): Promise<void> {
  if (input.wake.getTime() <= input.bed.getTime()) throw new Error('Время подъёма должно быть позже времени отбоя');
  const { error } = await supabase.from('sleep_entries').upsert(
    {
      user_id: input.userId,
      day: input.day,
      bed_time: input.bed.toISOString(),
      wake_time: input.wake.toISOString(),
      duration_min: Math.max(0, Math.min(1440, Math.round(input.durationMin))),
      source: input.source,
    },
    { onConflict: 'user_id,day' },
  );
  check(error);
}

export async function fetchMySleep(userId: string, day: string): Promise<SleepEntry | null> {
  const { data, error } = await supabase.from('sleep_entries').select('*').eq('user_id', userId).eq('day', day).maybeSingle();
  check(error);
  return (data as SleepEntry | null) ?? null;
}

export async function deleteSleep(id: string): Promise<void> {
  const { error } = await supabase.from('sleep_entries').delete().eq('id', id);
  check(error);
}

export async function addGratitude(day: string, text: string): Promise<void> {
  const { error } = await supabase.from('gratitudes').insert({ day, text: text.trim() });
  check(error);
}

export async function deleteGratitude(id: string): Promise<void> {
  const { error } = await supabase.from('gratitudes').delete().eq('id', id);
  check(error);
}

export async function fetchWishes(): Promise<Wish[]> {
  const { data, error } = await supabase.from('wishes').select('*').order('created_at', { ascending: false }).limit(300);
  check(error);
  return (data ?? []) as Wish[];
}

export async function addWish(input: { day: string; title: string; note: string | null; horizon: WishHorizon }): Promise<void> {
  const { error } = await supabase.from('wishes').insert({
    day: input.day,
    title: input.title.trim(),
    note: input.note?.trim() || null,
    horizon: input.horizon,
  });
  check(error);
}

export async function setWishDone(id: string, done: boolean): Promise<void> {
  const { error } = await supabase.from('wishes').update({ is_done: done }).eq('id', id);
  check(error);
}

export async function deleteWish(id: string): Promise<void> {
  const { error } = await supabase.from('wishes').delete().eq('id', id);
  check(error);
}

export async function saveDayScore(input: {
  userId: string;
  day: string;
  rating: number;
  autoScore: number | null;
  note: string | null;
}): Promise<void> {
  const { error } = await supabase.from('day_scores').upsert(
    {
      user_id: input.userId,
      day: input.day,
      rating: input.rating,
      auto_score: input.autoScore,
      note: input.note?.trim() || null,
    },
    { onConflict: 'user_id,day' },
  );
  check(error);
}

export async function sendNudge(userId: string): Promise<void> {
  const { error } = await supabase.from('nudges').insert({ from_user: userId });
  check(error);
}

// ---------- Web Push (iPhone: сайт на экране «Домой») ----------

export async function saveWebPush(sub: { endpoint: string; p256dh: string; auth: string }): Promise<void> {
  const { error } = await supabase.rpc('save_web_push', { p_endpoint: sub.endpoint, p_p256dh: sub.p256dh, p_auth: sub.auth });
  check(error);
}

export async function deleteWebPush(endpoint: string): Promise<void> {
  const { error } = await supabase.rpc('delete_web_push', { p_endpoint: endpoint });
  check(error);
}

// ---------- Гардероб и секретные коды (0.2) ----------

export type InventoryRow = { item_id: string; granted_at: string };

// Небесплатные вещи, которые у меня есть (бесплатные есть у всех и в инвентарь не пишутся)
export async function fetchInventory(): Promise<InventoryRow[]> {
  const { data, error } = await supabase.from('inventory').select('item_id, granted_at');
  check(error);
  return (data ?? []) as InventoryRow[];
}

export type RewardItem = { id: string; cat: string; name: string };
export type RedeemResult =
  | { ok: true; title: string; items: RewardItem[] }
  | { ok: false; error: 'rate' | 'not_found' | 'already' | 'taken'; message: string };

// Код проверяет только сервер: регистр и пробелы по краям не важны.
// Неверный код — не исключение, а ответ { ok: false } с готовым текстом.
export async function redeemCode(code: string): Promise<RedeemResult> {
  const { data, error } = await supabase.rpc('redeem_code', { p_code: code });
  check(error);
  const res = (data ?? {}) as { ok?: unknown; title?: unknown; items?: unknown; error?: unknown; message?: unknown };
  if (res.ok === true) {
    return { ok: true, title: typeof res.title === 'string' ? res.title : '', items: Array.isArray(res.items) ? (res.items as RewardItem[]) : [] };
  }
  if (res.ok === false) {
    const kind = res.error === 'rate' || res.error === 'already' || res.error === 'taken' ? res.error : 'not_found';
    return { ok: false, error: kind, message: typeof res.message === 'string' ? res.message : 'Код не найден' };
  }
  throw new Error('Сервер ответил непонятно — попробуй ещё раз');
}

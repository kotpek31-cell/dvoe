import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, Button, Card, Empty, ErrorBox, Input, Loading, Row, Screen, showError, Txt } from '../../src/components/ui';
import { usePair, useTableVersion } from '../../src/context/PairProvider';
import {
  addGratitude,
  answerQuestion,
  deleteGratitude,
  fetchDailyQuestion,
  fetchNudgesSince,
  fetchRange,
  fetchStreaks,
  sendNudge,
  setWater,
} from '../../src/lib/api';
import { confirmAction } from '../../src/lib/dialogs';
import { atTime, formatDayLong, formatTime, plural, todayKey } from '../../src/lib/dates';
import { getEmotion } from '../../src/lib/emotions';
import { useLoader } from '../../src/lib/hooks';
import { computeAutoScore, formatScore } from '../../src/lib/score';
import { refreshWidgets } from '../../src/lib/widgets';
import { C, R, S } from '../../src/theme';
import type { Profile } from '../../src/types';

export default function TodayScreen() {
  const { me, partner, pair, lastNudgeAt } = usePair();
  const day = todayKey();
  const version = useTableVersion(
    'profiles',
    'mood_entries',
    'sleep_entries',
    'water_logs',
    'gratitudes',
    'question_answers',
    'day_scores',
    'nudges',
  );

  const { data, setData, loading, refreshing, error, refresh, reload } = useLoader(async () => {
    const [range, question, streaks, nudges] = await Promise.all([
      fetchRange(day, day),
      fetchDailyQuestion(day),
      fetchStreaks(day),
      fetchNudgesSince(atTime(day, 0).toISOString()),
    ]);
    return { range, question, streaks, nudges };
  }, [day, version]);

  if (!me) return <Loading />;
  if (loading && !data) return <Loading />;

  const range = data?.range;
  const myWater = range?.water.find((w) => w.user_id === me.id)?.glasses ?? 0;
  const partnerWater = partner ? range?.water.find((w) => w.user_id === partner.id)?.glasses ?? 0 : 0;

  const autoFor = (person: Profile, answered: boolean) =>
    computeAutoScore({
      sleepMin: range?.sleeps.find((s) => s.user_id === person.id)?.duration_min ?? null,
      moods: range?.moods.filter((m) => m.user_id === person.id) ?? [],
      water: range?.water.find((w) => w.user_id === person.id)?.glasses ?? 0,
      waterGoal: person.water_goal,
      gratitudes: range?.gratitudes.filter((g) => g.user_id === person.id).length ?? 0,
      answered,
    });

  const myAuto = autoFor(me, Boolean(data?.question?.my_answer));
  const partnerAuto = partner ? autoFor(partner, Boolean(data?.question?.partner_answered)) : null;
  const myRating = range?.scores.find((s) => s.user_id === me.id)?.rating ?? null;
  const partnerRating = partner ? range?.scores.find((s) => s.user_id === partner.id)?.rating ?? null : null;
  const myStreak = data?.streaks.find((s) => s.user_id === me.id)?.streak ?? 0;
  const partnerStreak = partner ? data?.streaks.find((s) => s.user_id === partner.id)?.streak ?? 0 : 0;

  const changeWater = async (delta: number) => {
    const next = Math.max(0, Math.min(40, myWater + delta));
    if (next === myWater || !data) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    const others = data.range.water.filter((w) => w.user_id !== me.id);
    setData({ ...data, range: { ...data.range, water: [...others, { user_id: me.id, day, glasses: next }] } });
    try {
      await setWater(me.id, day, next);
    } catch (e) {
      showError(e);
      reload();
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Txt muted>{formatDayLong(day)}</Txt>
      <Row>
        <StreakChip label="Ты" value={myStreak} color={C.me} />
        {partner ? <StreakChip label={partner.display_name} value={partnerStreak} color={C.partner} /> : null}
      </Row>

      {error ? <ErrorBox message={error} onRetry={reload} /> : null}

      <PartnerCard
        me={me}
        partner={partner}
        inviteCode={pair?.invite_code ?? null}
        partnerMood={partner ? [...(range?.moods ?? [])].reverse().find((m) => m.user_id === partner.id) ?? null : null}
        partnerRating={partnerRating}
        sentToday={data?.nudges.filter((n) => n.from_user === me.id).length ?? 0}
        receivedToday={partner ? data?.nudges.filter((n) => n.from_user === partner.id).length ?? 0 : 0}
        lastNudgeAt={lastNudgeAt}
        onSent={reload}
      />

      <QuestionCard
        day={day}
        partnerName={partner?.display_name ?? 'Партнёр'}
        question={data?.question ?? null}
        onAnswered={reload}
      />

      <Card title="💧 Вода" right={<Txt bold>{`${myWater} / ${me.water_goal}`}</Txt>}>
        <View style={styles.drops}>
          {Array.from({ length: Math.min(me.water_goal, 16) }, (_, i) => (
            <Text key={i} style={[styles.drop, { opacity: i < myWater ? 1 : 0.2 }]}>
              💧
            </Text>
          ))}
        </View>
        <Row gap={S.md}>
          <Button title="−" variant="secondary" style={styles.flex} onPress={() => changeWater(-1)} />
          <Button title="+ стакан" style={styles.flex} onPress={() => changeWater(1)} />
        </Row>
        {partner ? (
          <Txt muted size={14}>
            {partner.display_name}: {partnerWater} из {partner.water_goal}
          </Txt>
        ) : null}
      </Card>

      <GratitudeCard
        day={day}
        me={me}
        partner={partner}
        items={range?.gratitudes ?? []}
        onChanged={reload}
      />

      <Card title="⭐ Оценка дня">
        <Row gap={S.md}>
          <ScoreBox title="Ты" color={C.me} rating={myRating} auto={myAuto.total} />
          {partner && partnerAuto ? (
            <ScoreBox title={partner.display_name} color={C.partner} rating={partnerRating} auto={partnerAuto.total} />
          ) : null}
        </Row>
        <Button
          title={myRating ? 'Изменить оценку дня' : 'Оценить день'}
          variant={myRating ? 'secondary' : 'primary'}
          onPress={() => router.push('/day-score')}
        />
      </Card>
    </Screen>
  );
}

function StreakChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.streak, { borderColor: color }]}>
      <Text style={styles.streakText} numberOfLines={1}>
        🔥 {label}: {value} {plural(value, 'день', 'дня', 'дней')}
      </Text>
    </View>
  );
}

function ScoreBox({ title, color, rating, auto }: { title: string; color: string; rating: number | null; auto: number }) {
  return (
    <View style={[styles.scoreBox, { borderColor: color }]}>
      <Txt muted size={13} numberOfLines={1}>
        {title}
      </Txt>
      <Txt size={30} bold>
        {rating != null ? `${rating}` : '—'}
        <Txt muted size={15}>
          {' '}
          /10
        </Txt>
      </Txt>
      <Txt muted size={13}>
        авто: {formatScore(auto)}
      </Txt>
    </View>
  );
}

function PartnerCard({
  me,
  partner,
  inviteCode,
  partnerMood,
  partnerRating,
  sentToday,
  receivedToday,
  lastNudgeAt,
  onSent,
}: {
  me: Profile;
  partner: Profile | null;
  inviteCode: string | null;
  partnerMood: { emotion: string; sub_emotion: string | null; created_at: string } | null;
  partnerRating: number | null;
  sentToday: number;
  receivedToday: number;
  lastNudgeAt: number | null;
  onSent: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const [banner, setBanner] = useState(false);

  // Партнёр прислал «Думаю о тебе», пока приложение открыто
  useEffect(() => {
    if (!lastNudgeAt) return;
    setBanner(true);
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.25, duration: 180, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => setBanner(false), 4000);
    return () => clearTimeout(t);
  }, [lastNudgeAt, scale]);

  if (!partner) {
    return (
      <Card title="Партнёр ещё не с вами">
        <Txt muted>Отправьте код пары второму человеку: {inviteCode ?? '—'}</Txt>
        <Button title="Показать код" variant="secondary" onPress={() => router.push('/pair')} />
      </Card>
    );
  }

  const emotion = partnerMood ? getEmotion(partnerMood.emotion) : null;
  const status = partner.sleeping_since
    ? `😴 спит с ${formatTime(partner.sleeping_since)}`
    : emotion && partnerMood
      ? `${emotion.emoji} ${emotion.label}${partnerMood.sub_emotion ? ` · ${partnerMood.sub_emotion}` : ''} · ${formatTime(partnerMood.created_at)}`
      : 'Настроение сегодня ещё не отмечено';

  const nudge = async () => {
    if (cooldown) return;
    setSending(true);
    try {
      await sendNudge(me.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.2, duration: 140, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 3, useNativeDriver: true }),
      ]).start();
      setCooldown(true);
      setTimeout(() => setCooldown(false), 5000);
      onSent();
    } catch (e) {
      showError(e);
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>💗 {partner.display_name} думает о тебе</Text>
        </View>
      ) : null}
      <Row gap={S.md}>
        <Avatar emoji={partner.avatar_emoji} color={C.partner} size={48} />
        <View style={styles.flex}>
          <Txt size={18} bold numberOfLines={1}>
            {partner.display_name}
          </Txt>
          <Txt muted size={14}>
            {status}
          </Txt>
        </View>
        {partnerRating != null ? (
          <View style={styles.ratingPill}>
            <Text style={styles.ratingText}>⭐ {partnerRating}</Text>
          </View>
        ) : null}
      </Row>
      <Pressable
        onPress={nudge}
        disabled={sending}
        style={({ pressed }) => [styles.nudge, { opacity: pressed || sending ? 0.85 : 1 }]}
      >
        <Animated.Text style={[styles.nudgeHeart, { transform: [{ scale }] }]}>💗</Animated.Text>
        <Text style={styles.nudgeText}>{cooldown ? 'Отправлено!' : 'Думаю о тебе'}</Text>
      </Pressable>
      <Txt muted size={13} style={styles.centerText}>
        Сегодня: ты — {sentToday}, {partner.display_name} — {receivedToday}
      </Txt>
    </Card>
  );
}

function QuestionCard({
  day,
  partnerName,
  question,
  onAnswered,
}: {
  day: string;
  partnerName: string;
  question: {
    question_id: number;
    text: string;
    my_answer: string | null;
    partner_answered: boolean;
    partner_answer: string | null;
  } | null;
  onAnswered: () => void;
}) {
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);

  if (!question) {
    return (
      <Card title="💬 Вопрос дня">
        <Empty text="Вопросы не найдены — проверьте, что supabase/schema.sql выполнен полностью." />
      </Card>
    );
  }

  const submit = () => {
    if (!answer.trim()) return;
    confirmAction('Отправить ответ?', 'Изменить его потом будет нельзя.', 'Отправить', async () => {
      setBusy(true);
      try {
        await answerQuestion(day, question.question_id, answer);
        setAnswer('');
        onAnswered();
      } catch (e) {
        showError(e);
      } finally {
        setBusy(false);
      }
    });
  };

  return (
    <Card title="💬 Вопрос дня" right={<Button title="Архив" variant="ghost" small onPress={() => router.push('/questions')} />}>
      <Txt size={18} bold>
        {question.text}
      </Txt>
      {question.my_answer ? (
        <>
          <View style={[styles.answer, { borderColor: C.me }]}>
            <Txt muted size={12}>
              Твой ответ
            </Txt>
            <Txt>{question.my_answer}</Txt>
          </View>
          {question.partner_answer ? (
            <View style={[styles.answer, { borderColor: C.partner }]}>
              <Txt muted size={12}>
                {partnerName}
              </Txt>
              <Txt>{question.partner_answer}</Txt>
            </View>
          ) : (
            <Txt muted>⏳ Ждём ответ: {partnerName}. Ответы откроются, когда ответите оба.</Txt>
          )}
        </>
      ) : (
        <>
          <Txt muted size={14}>
            {question.partner_answered
              ? `✅ ${partnerName} уже ответил(а). Ответь, чтобы увидеть ответ.`
              : 'Ответы откроются, когда ответите оба.'}
          </Txt>
          <Input placeholder="Твой ответ…" value={answer} onChangeText={setAnswer} multiline maxLength={2000} />
          <Button title="Ответить" onPress={submit} loading={busy} disabled={!answer.trim()} />
        </>
      )}
    </Card>
  );
}

function GratitudeCard({
  day,
  me,
  partner,
  items,
  onChanged,
}: {
  day: string;
  me: Profile;
  partner: Profile | null;
  items: { id: string; user_id: string; text: string }[];
  onChanged: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const sorted = useMemo(() => [...items].reverse(), [items]);

  const add = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await addGratitude(day, text);
      setText('');
      onChanged();
      refreshWidgets();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const remove = (id: string) =>
    confirmAction(
      'Удалить запись?',
      undefined,
      'Удалить',
      async () => {
        try {
          await deleteGratitude(id);
          onChanged();
        } catch (e) {
          showError(e);
        }
      },
      true,
    );

  return (
    <Card title="🙏 Благодарность дня">
      <Input placeholder="За что я благодарен сегодня…" value={text} onChangeText={setText} maxLength={500} />
      <Button title="Добавить" variant="secondary" onPress={add} loading={busy} disabled={!text.trim()} />
      {sorted.length === 0 ? <Empty text="Пока пусто — начните первым 🙂" /> : null}
      {sorted.map((g) => {
        const mine = g.user_id === me.id;
        const author = mine ? me : partner;
        return (
          <Pressable key={g.id} onLongPress={mine ? () => remove(g.id) : undefined} style={styles.gratitude}>
            <Text style={styles.gratitudeEmoji}>{author?.avatar_emoji ?? '🙂'}</Text>
            <View style={styles.flex}>
              <Txt size={12} color={mine ? C.me : C.partner}>
                {mine ? 'Ты' : author?.display_name ?? 'Партнёр'}
              </Txt>
              <Txt>{g.text}</Txt>
            </View>
          </Pressable>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centerText: { textAlign: 'center' },
  streak: { flexShrink: 1, borderWidth: 1, borderRadius: R.pill, paddingHorizontal: S.md, paddingVertical: 6 },
  streakText: { color: C.text, fontSize: 13, fontWeight: '600' },
  drops: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  drop: { fontSize: 20 },
  scoreBox: { flex: 1, borderWidth: 1, borderRadius: R.md, padding: S.md, gap: 2 },
  nudge: {
    backgroundColor: C.accentSoft,
    borderRadius: R.lg,
    paddingVertical: S.lg,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#5A2A38',
  },
  nudgeHeart: { fontSize: 36 },
  nudgeText: { color: C.partner, fontSize: 17, fontWeight: '700' },
  banner: { backgroundColor: C.accent, borderRadius: R.md, padding: S.sm },
  bannerText: { color: '#1A0A10', fontWeight: '700', textAlign: 'center' },
  ratingPill: { backgroundColor: C.card2, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4 },
  ratingText: { color: C.warn, fontWeight: '700' },
  answer: { borderLeftWidth: 3, paddingLeft: S.md, gap: 2 },
  gratitude: { flexDirection: 'row', gap: S.md, alignItems: 'flex-start', paddingVertical: 4 },
  gratitudeEmoji: { fontSize: 22 },
});

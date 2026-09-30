import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, ErrorBox, Input, Loading, Row, Screen, showError, Txt } from '../src/components/ui';
import { usePair, useTableVersion } from '../src/context/PairProvider';
import { fetchDailyQuestion, fetchRange, saveDayScore } from '../src/lib/api';
import { formatDayLong, formatDuration, todayKey } from '../src/lib/dates';
import { scoreColor } from '../src/lib/emotions';
import { useLoader } from '../src/lib/hooks';
import { computeAutoScore, formatScore } from '../src/lib/score';
import { refreshWidgets } from '../src/lib/widgets';
import { C, R, S } from '../src/theme';

export default function DayScoreScreen() {
  const { me, partner } = usePair();
  const day = todayKey();
  const version = useTableVersion('day_scores', 'mood_entries', 'sleep_entries', 'water_logs', 'gratitudes', 'question_answers');
  const { data, loading, error, reload } = useLoader(async () => {
    const [range, question] = await Promise.all([fetchRange(day, day), fetchDailyQuestion(day)]);
    return { range, question };
  }, [day, version]);

  const [rating, setRating] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  // Если оценка уже стоит — подставляем её для редактирования
  useEffect(() => {
    if (!data || !me || prefilled) return;
    const existing = data.range.scores.find((s) => s.user_id === me.id);
    if (existing) {
      setRating(existing.rating);
      setNote(existing.note ?? '');
    }
    setPrefilled(true);
  }, [data, me, prefilled]);

  if (!me || (loading && !data)) return <Loading />;

  const range = data?.range;
  const sleep = range?.sleeps.find((s) => s.user_id === me.id) ?? null;
  const auto = computeAutoScore({
    sleepMin: sleep?.duration_min ?? null,
    moods: range?.moods.filter((m) => m.user_id === me.id) ?? [],
    water: range?.water.find((w) => w.user_id === me.id)?.glasses ?? 0,
    waterGoal: me.water_goal,
    gratitudes: range?.gratitudes.filter((g) => g.user_id === me.id).length ?? 0,
    answered: Boolean(data?.question?.my_answer),
  });
  const partnerScore = partner ? range?.scores.find((s) => s.user_id === partner.id) ?? null : null;
  const doneCount = auto.checklist.filter((c) => c.done).length;

  const save = async () => {
    if (rating == null) return showError('Выберите оценку от 1 до 10');
    setBusy(true);
    try {
      await saveDayScore({ userId: me.id, day, rating, autoScore: auto.total, note: note || null });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      refreshWidgets();
      if (router.canGoBack()) router.back();
      else router.replace('/today');
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Txt muted>{formatDayLong(day)}</Txt>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}

      <Card title="Как прошёл твой день?">
        <View style={styles.grid}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            const active = n === rating;
            const color = scoreColor(n) ?? C.card2;
            return (
              <Pressable
                key={n}
                onPress={() => {
                  setRating(n);
                  Haptics.selectionAsync().catch(() => undefined);
                }}
                style={[styles.num, { borderColor: color }, active && { backgroundColor: color }]}
              >
                <Text style={[styles.numText, active && styles.numTextActive]}>{n}</Text>
              </Pressable>
            );
          })}
        </View>
        <Input placeholder="Пара слов о дне (необязательно)" value={note} onChangeText={setNote} multiline maxLength={1000} />
        <Button title="Сохранить оценку" onPress={save} loading={busy} disabled={rating == null} />
      </Card>

      <Card title="Автоматический балл" right={<Txt size={28} bold color={scoreColor(auto.total) ?? C.text}>{formatScore(auto.total)}</Txt>}>
        <Row style={styles.part}>
          <Txt muted>😴 Сон</Txt>
          <Txt>
            {auto.sleep != null ? `${formatScore(auto.sleep)}/10 · ${formatDuration(sleep?.duration_min)}` : 'нет данных'}
          </Txt>
        </Row>
        <Row style={styles.part}>
          <Txt muted>🎭 Настроение</Txt>
          <Txt>{auto.mood != null ? `${formatScore(auto.mood)}/10` : 'нет отметок'}</Txt>
        </Row>
        <Row style={styles.part}>
          <Txt muted>✅ Выполнено</Txt>
          <Txt>
            {doneCount} из {auto.checklist.length}
          </Txt>
        </Row>
        {auto.checklist.map((c) => (
          <Txt key={c.key} size={14} color={c.done ? C.good : C.faint}>
            {c.done ? '✓' : '○'} {c.label}
          </Txt>
        ))}
        <Txt muted size={12}>
          Сон 35% (7–9 часов = максимум), настроение 40%, выполненные пункты 25%.
        </Txt>
      </Card>

      {partner ? (
        <Card title={partner.display_name}>
          {partnerScore ? (
            <>
              <Txt size={22} bold color={C.partner}>
                {partnerScore.rating}/10
              </Txt>
              {partnerScore.note ? <Txt muted>«{partnerScore.note}»</Txt> : null}
            </>
          ) : (
            <Txt muted>Ещё не оценил(а) день</Txt>
          )}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: S.sm },
  num: {
    width: '18%',
    aspectRatio: 1,
    borderRadius: R.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.card2,
  },
  numText: { color: C.text, fontSize: 20, fontWeight: '700' },
  numTextActive: { color: '#FFFFFF' },
  part: { justifyContent: 'space-between' },
});

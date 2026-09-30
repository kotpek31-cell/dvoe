// Итог дня: своя оценка 1–10 и автоматический балл (сон, настроение, дела дня)
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, ErrorBox, Input, Pressy, Row, Screen, showError, Txt } from '../src/components/ui';
import { usePair, useTableVersion } from '../src/context/PairProvider';
import { fetchDailyQuestion, fetchRange, saveDayScore } from '../src/lib/api';
import { formatDayLong, formatDuration, todayKey } from '../src/lib/dates';
import { scoreColor } from '../src/lib/emotions';
import { useLoader } from '../src/lib/hooks';
import { haptic } from '../src/lib/motion';
import { computeAutoScore, formatScore } from '../src/lib/score';
import { refreshWidgets } from '../src/lib/widgets';
import { C, R, S } from '../src/theme';

export default function DayScoreScreen() {
  const { me, partner } = usePair();
  const day = todayKey();
  const version = useTableVersion('day_scores', 'mood_entries', 'sleep_entries', 'gratitudes', 'question_answers');
  const { data, error, reload } = useLoader(async () => {
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

  if (!me) return null;

  const range = data?.range;
  const sleep = range?.sleeps.find((s) => s.user_id === me.id) ?? null;
  const auto = computeAutoScore({
    sleepMin: sleep?.duration_min ?? null,
    moods: range?.moods.filter((m) => m.user_id === me.id) ?? [],
    gratitudes: range?.gratitudes.filter((g) => g.user_id === me.id).length ?? 0,
    answered: Boolean(data?.question?.my_answer),
  });
  const partnerScore = partner ? range?.scores.find((s) => s.user_id === partner.id) ?? null : null;
  const doneCount = auto.checklist.filter((c) => c.done).length;

  const save = async () => {
    if (rating == null) return showError('Выбери оценку от 1 до 10');
    setBusy(true);
    try {
      await saveDayScore({ userId: me.id, day, rating, autoScore: auto.total, note: note || null });
      haptic.success();
      refreshWidgets();
      if (router.canGoBack()) router.back();
      else router.replace('/us');
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen background back title="Итог дня" subtitle={formatDayLong(day)}>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}

      <Card title="Как прошёл твой день?">
        <View style={styles.grid}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            const active = n === rating;
            const color = scoreColor(n) ?? C.card2;
            return (
              <Pressy
                key={n}
                onPress={() => setRating(n)}
                scaleTo={0.85}
                style={styles.numWrap}
                innerStyle={[styles.num, { borderColor: color }, active ? { backgroundColor: color } : null]}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`${n} из 10`}
              >
                <Txt weight="display" size={20} color={active ? '#FFFFFF' : C.text}>
                  {n}
                </Txt>
              </Pressy>
            );
          })}
        </View>
        <Input placeholder="Пара слов о дне (необязательно)" value={note} onChangeText={setNote} multiline maxLength={1000} />
        <Button title="Сохранить оценку" icon="check" onPress={save} loading={busy} disabled={rating == null} />
      </Card>

      <Card
        title="Автоматический балл"
        right={
          <Txt weight="display" size={28} color={scoreColor(auto.total) ?? C.text}>
            {formatScore(auto.total)}
          </Txt>
        }
      >
        <Row style={styles.part}>
          <Txt muted>Сон</Txt>
          <Txt>{auto.sleep != null ? `${formatScore(auto.sleep)}/10 · ${formatDuration(sleep?.duration_min)}` : 'нет данных'}</Txt>
        </Row>
        <Row style={styles.part}>
          <Txt muted>Настроение</Txt>
          <Txt>{auto.mood != null ? `${formatScore(auto.mood)}/10` : 'нет отметок'}</Txt>
        </Row>
        <Row style={styles.part}>
          <Txt muted>Выполнено</Txt>
          <Txt>
            {doneCount} из {auto.checklist.length}
          </Txt>
        </Row>
        {auto.checklist.map((c) => (
          <Txt key={c.key} size={14} color={c.done ? C.good : C.faint}>
            {c.done ? '✓' : '○'} {c.label}
          </Txt>
        ))}
        <Txt faint size={12}>
          Сон 35% (7–9 часов = максимум), настроение 40%, выполненные пункты 25%.
        </Txt>
      </Card>

      {partner ? (
        <Card title={partner.display_name}>
          {partnerScore ? (
            <>
              <Txt weight="display" size={24} color={C.partner}>
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
  numWrap: { width: '18%' },
  num: {
    aspectRatio: 1,
    borderRadius: R.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  part: { justifyContent: 'space-between' },
});

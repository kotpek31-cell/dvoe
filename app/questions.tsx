import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Empty, ErrorBox, Screen, Txt } from '../src/components/ui';
import { usePair, useTableVersion } from '../src/context/PairProvider';
import { fetchAnswerArchive } from '../src/lib/api';
import { formatDayLong } from '../src/lib/dates';
import { useLoader } from '../src/lib/hooks';
import { C, S } from '../src/theme';

// Архив вопросов дня. Ответ партнёра виден только за дни, когда ответили оба (так устроен RLS).
export default function QuestionsArchive() {
  const { me, partner } = usePair();
  const version = useTableVersion('question_answers');
  const { data, loading, refreshing, error, refresh, reload } = useLoader(fetchAnswerArchive, [version]);

  const days = useMemo(() => {
    const byDay = new Map<string, { question: string; mine: string | null; theirs: string | null }>();
    for (const row of data ?? []) {
      const entry = byDay.get(row.day) ?? { question: row.questions?.text ?? 'Вопрос', mine: null, theirs: null };
      if (row.user_id === me?.id) entry.mine = row.answer;
      else entry.theirs = row.answer;
      byDay.set(row.day, entry);
    }
    return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [data, me?.id]);

  return (
    <Screen background back title="Архив вопросов" refreshing={refreshing} onRefresh={refresh}>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {!loading && days.length === 0 ? <Empty text="Здесь появятся ваши ответы на вопросы дня" /> : null}
      {days.map(([day, item]) => (
        <Card key={day}>
          <Txt faint size={13}>
            {formatDayLong(day)}
          </Txt>
          <Txt weight="displaySemi" size={16}>
            {item.question}
          </Txt>
          <View style={[styles.answer, { borderColor: C.me }]}>
            <Txt faint size={12}>
              Ты
            </Txt>
            <Txt>{item.mine ?? '—'}</Txt>
          </View>
          <View style={[styles.answer, { borderColor: C.partner }]}>
            <Txt faint size={12}>
              {partner?.display_name ?? 'Партнёр'}
            </Txt>
            <Txt>{item.theirs ?? 'не ответил(а)'}</Txt>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  answer: { borderLeftWidth: 3, paddingLeft: S.md, gap: 2 },
});

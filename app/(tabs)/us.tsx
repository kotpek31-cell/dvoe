// «Мы»: вопрос дня (переворачивается, когда ответили оба), благодарности и оценка дня
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { FlipCard } from '../../src/components/FlipCard';
import { Icon } from '../../src/components/Icon';
import { Button, Card, Empty, ErrorBox, Input, Row, Screen, showError, Txt } from '../../src/components/ui';
import { usePair, useTableVersion } from '../../src/context/PairProvider';
import { addGratitude, answerQuestion, deleteGratitude, fetchDailyQuestion, fetchNudgesSince, fetchRange } from '../../src/lib/api';
import { atTime, formatDayLong, plural, todayKey } from '../../src/lib/dates';
import { confirmAction } from '../../src/lib/dialogs';
import { scoreColor } from '../../src/lib/emotions';
import { useLoader } from '../../src/lib/hooks';
import { haptic } from '../../src/lib/motion';
import { computeAutoScore, formatScore } from '../../src/lib/score';
import { refreshWidgets } from '../../src/lib/widgets';
import { C, R, S } from '../../src/theme';
import type { DailyQuestion, Gratitude, Profile } from '../../src/types';

export default function UsScreen() {
  const { me, partner } = usePair();
  const day = todayKey();
  const version = useTableVersion('question_answers', 'gratitudes', 'day_scores', 'mood_entries', 'sleep_entries', 'nudges');
  const { data, refreshing, error, refresh, reload } = useLoader(async () => {
    const [range, question, nudges] = await Promise.all([
      fetchRange(day, day),
      fetchDailyQuestion(day),
      fetchNudgesSince(atTime(day, 0).toISOString()),
    ]);
    return { range, question, nudges };
  }, [day, version]);

  if (!me) return null;

  const range = data?.range;
  const autoFor = (person: Profile, answered: boolean) =>
    computeAutoScore({
      sleepMin: range?.sleeps.find((s) => s.user_id === person.id)?.duration_min ?? null,
      moods: range?.moods.filter((m) => m.user_id === person.id) ?? [],
      gratitudes: range?.gratitudes.filter((g) => g.user_id === person.id).length ?? 0,
      answered,
    }).total;
  const myRating = range?.scores.find((s) => s.user_id === me.id)?.rating ?? null;
  const partnerRating = partner ? range?.scores.find((s) => s.user_id === partner.id)?.rating ?? null : null;
  const sent = data?.nudges.filter((n) => n.from_user === me.id).length ?? 0;
  const received = partner ? data?.nudges.filter((n) => n.from_user === partner.id).length ?? 0 : 0;

  return (
    <Screen tabs title="Мы" subtitle={formatDayLong(day)} refreshing={refreshing} onRefresh={refresh}>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}

      <QuestionCard
        day={day}
        partnerName={partner?.display_name ?? 'Партнёр'}
        question={data?.question ?? null}
        loaded={Boolean(data)}
        onAnswered={reload}
      />

      {partner ? (
        <Card>
          <Row gap={S.md}>
            <View style={styles.heartBadge}>
              <Icon name="heart" size={20} color={C.accent} fill={C.accent} />
            </View>
            <View style={styles.flex}>
              <Txt weight="heavy" size={15}>
                «Думаю о тебе» сегодня
              </Txt>
              <Txt muted size={14}>
                ты — {sent}, {partner.display_name} — {received}. Отправить — нажми на чибика на главной.
              </Txt>
            </View>
          </Row>
        </Card>
      ) : null}

      <GratitudeCard day={day} me={me} partner={partner} items={range?.gratitudes ?? []} onChanged={reload} />

      <Card title="Оценка дня">
        <Row gap={S.md}>
          <ScoreBox title="Ты" color={C.me} rating={myRating} auto={autoFor(me, Boolean(data?.question?.my_answer))} />
          {partner ? (
            <ScoreBox
              title={partner.display_name}
              color={C.partner}
              rating={partnerRating}
              auto={autoFor(partner, Boolean(data?.question?.partner_answered))}
            />
          ) : null}
        </Row>
        <Button
          title={myRating ? 'Изменить оценку дня' : 'Оценить день'}
          icon="star"
          variant={myRating ? 'secondary' : 'primary'}
          onPress={() => router.push('/day-score')}
        />
      </Card>
    </Screen>
  );
}

function ScoreBox({ title, color, rating, auto }: { title: string; color: string; rating: number | null; auto: number }) {
  return (
    <View style={[styles.scoreBox, { borderColor: color }]}>
      <Txt muted size={13} numberOfLines={1}>
        {title}
      </Txt>
      <Txt weight="display" size={30} color={rating != null ? scoreColor(rating) ?? C.text : C.text}>
        {rating != null ? `${rating}` : '—'}
        <Txt weight="bold" size={15} faint>
          {' '}
          /10
        </Txt>
      </Txt>
      <Txt faint size={13}>
        авто: {formatScore(auto)}
      </Txt>
    </View>
  );
}

function QuestionCard({
  day,
  partnerName,
  question,
  loaded,
  onAnswered,
}: {
  day: string;
  partnerName: string;
  question: DailyQuestion | null;
  loaded: boolean;
  onAnswered: () => void;
}) {
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loaded) {
    return (
      <Card title="Вопрос дня">
        <Empty text="Загружаем…" />
      </Card>
    );
  }
  if (!question) {
    return (
      <Card title="Вопрос дня">
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
        haptic.success();
        setAnswer('');
        onAnswered();
      } catch (e) {
        showError(e);
      } finally {
        setBusy(false);
      }
    });
  };

  const archive = (
    <Pressable onPress={() => router.push('/questions')} hitSlop={10} accessibilityRole="link" style={styles.archive}>
      <Icon name="archive" size={16} color={C.accent} />
      <Txt weight="heavy" size={13} color={C.accent}>
        Архив
      </Txt>
    </Pressable>
  );

  const both = Boolean(question.my_answer && question.partner_answer);

  const front = (
    <Card title="Вопрос дня" right={archive}>
      <Txt weight="displaySemi" size={19}>
        {question.text}
      </Txt>
      {question.my_answer ? (
        <>
          <View style={[styles.answer, { borderColor: C.me }]}>
            <Txt faint size={12}>
              Твой ответ
            </Txt>
            <Txt>{question.my_answer}</Txt>
          </View>
          <Txt muted size={14}>
            Ждём ответ: {partnerName}. Карточка перевернётся, когда ответите оба.
          </Txt>
        </>
      ) : (
        <>
          <Txt muted size={14}>
            {question.partner_answered
              ? `${partnerName} уже ответил(а). Ответь, чтобы увидеть ответ.`
              : 'Ответы откроются, когда ответите оба.'}
          </Txt>
          <Input placeholder="Твой ответ…" value={answer} onChangeText={setAnswer} multiline maxLength={2000} />
          <Button title="Ответить" icon="chat" onPress={submit} loading={busy} disabled={!answer.trim()} />
        </>
      )}
    </Card>
  );

  const back = (
    <Card title="Вы оба ответили" right={archive} tint="rgba(255,107,138,0.1)" style={styles.backCard}>
      <Txt weight="displaySemi" size={17}>
        {question.text}
      </Txt>
      <View style={[styles.answer, { borderColor: C.me }]}>
        <Txt faint size={12}>
          Ты
        </Txt>
        <Txt>{question.my_answer ?? ''}</Txt>
      </View>
      <View style={[styles.answer, { borderColor: C.partner }]}>
        <Txt faint size={12}>
          {partnerName}
        </Txt>
        <Txt>{question.partner_answer ?? ''}</Txt>
      </View>
    </Card>
  );

  return <FlipCard flipped={both} front={front} back={back} />;
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
  items: Gratitude[];
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
      haptic.success();
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
    <Card title="Благодарности">
      <Input placeholder="За что я благодарен(на) сегодня…" value={text} onChangeText={setText} maxLength={500} />
      <Button title="Добавить" variant="secondary" icon="plus" onPress={add} loading={busy} disabled={!text.trim()} />
      {sorted.length === 0 ? <Empty text="Пока пусто — начни первым" /> : null}
      {sorted.map((g) => {
        const mine = g.user_id === me.id;
        return (
          <Pressable key={g.id} onLongPress={mine ? () => remove(g.id) : undefined} style={styles.gratitude}>
            <View style={[styles.gDot, { backgroundColor: mine ? C.me : C.partner }]} />
            <View style={styles.flex}>
              <Txt weight="heavy" size={12} color={mine ? C.me : C.partner}>
                {mine ? 'Ты' : partner?.display_name ?? 'Партнёр'}
              </Txt>
              <Txt>{g.text}</Txt>
            </View>
          </Pressable>
        );
      })}
      {sorted.some((g) => g.user_id === me.id) ? (
        <Txt faint size={12} center>
          Удержи свою запись, чтобы удалить её · {sorted.length} {plural(sorted.length, 'запись', 'записи', 'записей')} за сегодня
        </Txt>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  heartBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,107,138,0.2)',
  },
  scoreBox: { flex: 1, borderWidth: 1, borderRadius: R.md, padding: S.md, gap: 2, backgroundColor: 'rgba(255,255,255,0.03)' },
  answer: { borderLeftWidth: 3, paddingLeft: S.md, gap: 2 },
  archive: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  backCard: { borderColor: 'rgba(255,143,168,0.4)' },
  gratitude: { flexDirection: 'row', gap: S.md, alignItems: 'flex-start', paddingVertical: 4 },
  gDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});

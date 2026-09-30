import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Empty, ErrorBox, Input, Loading, Row, Screen, Segmented, showError, Txt } from '../../src/components/ui';
import { usePair, useTableVersion } from '../../src/context/PairProvider';
import { addWish, deleteWish, fetchWishes, setWishDone } from '../../src/lib/api';
import { confirmAction } from '../../src/lib/dialogs';
import { formatDayShort, dayKeyOf, relativeDay, todayKey } from '../../src/lib/dates';
import { useLoader } from '../../src/lib/hooks';
import { C, R, S } from '../../src/theme';
import type { Wish, WishHorizon } from '../../src/types';

type Filter = 'today' | 'future' | 'done';

export default function WishesScreen() {
  const { me, partner } = usePair();
  const day = todayKey();
  const version = useTableVersion('wishes');
  const { data, setData, loading, refreshing, error, refresh, reload } = useLoader(fetchWishes, [version]);

  const [filter, setFilter] = useState<Filter>('today');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [horizon, setHorizon] = useState<WishHorizon>('today');
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => {
    const all = data ?? [];
    if (filter === 'done') return all.filter((w) => w.is_done);
    if (filter === 'future') return all.filter((w) => w.horizon === 'future' && !w.is_done);
    // «Сегодня»: всё неисполненное на сегодня + исполненное сегодня
    return all.filter((w) => w.horizon === 'today' && (!w.is_done || (w.done_at != null && dayKeyOf(w.done_at) === day)));
  }, [data, filter, day]);

  if (!me) return <Loading />;
  if (loading && !data) return <Loading />;

  const nameOf = (userId: string | null) =>
    userId === me.id ? 'ты' : userId && partner && userId === partner.id ? partner.display_name : 'партнёр';

  const add = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await addWish({ day, title, note: note || null, horizon });
      setTitle('');
      setNote('');
      setFilter(horizon);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      reload();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const toggleDone = async (wish: Wish) => {
    const done = !wish.is_done;
    if (data) setData(data.map((w) => (w.id === wish.id ? { ...w, is_done: done, done_by: done ? me.id : null } : w)));
    try {
      await setWishDone(wish.id, done);
      if (done) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      reload();
    } catch (e) {
      showError(e);
      reload();
    }
  };

  const remove = (wish: Wish) =>
    confirmAction(
      'Удалить желание?', wish.title,
      'Удалить',
      async () => {
          try {
            await deleteWish(wish.id);
            reload();
          } catch (e) {
            showError(e);
          }
      },
      true,
    );

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}

      <Card title="Новое желание">
        <Input placeholder="Чего хочется? Например: погулять вечером" value={title} onChangeText={setTitle} maxLength={200} />
        <Input placeholder="Подробности (необязательно)" value={note} onChangeText={setNote} maxLength={1000} />
        <Segmented
          options={[
            { value: 'today', label: 'На сегодня' },
            { value: 'future', label: 'На будущее' },
          ]}
          value={horizon}
          onChange={setHorizon}
        />
        <Button title="Добавить" onPress={add} loading={busy} disabled={!title.trim()} />
      </Card>

      <Segmented
        options={[
          { value: 'today', label: 'Сегодня' },
          { value: 'future', label: 'Будущее' },
          { value: 'done', label: 'Исполнено' },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {list.length === 0 ? (
        <Empty
          text={
            filter === 'done' ? 'Исполненных желаний пока нет' : 'Здесь пусто. Добавьте желание — партнёр сможет его исполнить 🎁'
          }
        />
      ) : null}

      {list.map((w) => {
        const mine = w.user_id === me.id;
        return (
          <View key={w.id} style={[styles.wish, { borderLeftColor: mine ? C.me : C.partner }]}>
            <Txt bold size={16} style={w.is_done ? styles.doneTitle : undefined}>
              {w.title}
            </Txt>
            {w.note ? (
              <Txt muted size={14}>
                {w.note}
              </Txt>
            ) : null}
            <Txt muted size={12}>
              {mine ? 'Твоё желание' : `Желание: ${nameOf(w.user_id)}`} · {relativeDay(w.day)}
              {w.is_done && w.done_at ? ` · исполнил(а) ${nameOf(w.done_by)}, ${formatDayShort(dayKeyOf(w.done_at))}` : ''}
            </Txt>
            <Row gap={S.sm}>
              {w.is_done ? (
                <Button title="Вернуть" variant="secondary" small onPress={() => toggleDone(w)} />
              ) : mine ? (
                <Button title="✓ Сбылось" variant="secondary" small onPress={() => toggleDone(w)} />
              ) : (
                <Button title="🎁 Исполню!" small onPress={() => toggleDone(w)} />
              )}
              {mine ? <Button title="Удалить" variant="ghost" small onPress={() => remove(w)} /> : null}
            </Row>
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  wish: {
    backgroundColor: C.card,
    borderRadius: R.md,
    padding: S.lg,
    gap: 6,
    borderLeftWidth: 4,
  },
  doneTitle: { textDecorationLine: 'line-through', color: C.muted },
});

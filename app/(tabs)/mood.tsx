import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip, Dots, Empty, ErrorBox, Input, Loading, Row, Screen, showError, Txt } from '../../src/components/ui';
import { usePair, useTableVersion } from '../../src/context/PairProvider';
import { addMood, deleteMood, fetchMoods } from '../../src/lib/api';
import { confirmAction } from '../../src/lib/dialogs';
import { formatTime, todayKey } from '../../src/lib/dates';
import { EMOTIONS, getEmotion, INTENSITY_LABELS } from '../../src/lib/emotions';
import { useLoader } from '../../src/lib/hooks';
import { refreshWidgets } from '../../src/lib/widgets';
import { C, R, S } from '../../src/theme';
import type { MoodEntry } from '../../src/types';

export default function MoodScreen() {
  const { me, partner } = usePair();
  const day = todayKey();
  const version = useTableVersion('mood_entries');
  const { data, loading, refreshing, error, refresh, reload } = useLoader(() => fetchMoods(day, day), [day, version]);

  const [emotionKey, setEmotionKey] = useState<string | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(3);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (!me) return <Loading />;
  if (loading && !data) return <Loading />;

  const selected = emotionKey ? getEmotion(emotionKey) : null;

  const pick = (key: string) => {
    Haptics.selectionAsync().catch(() => undefined);
    setEmotionKey(key === emotionKey ? null : key);
    setSub(null);
  };

  const save = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await addMood({ day, emotion: selected.key, subEmotion: sub, intensity, note: note || null });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setEmotionKey(null);
      setSub(null);
      setIntensity(3);
      setNote('');
      reload();
      refreshWidgets();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const remove = (entry: MoodEntry) =>
    confirmAction(
      'Удалить отметку?', `${getEmotion(entry.emotion).label}, ${formatTime(entry.created_at)}`,
      'Удалить',
      async () => {
          try {
            await deleteMood(entry.id);
            reload();
            refreshWidgets();
          } catch (e) {
            showError(e);
          }
      },
      true,
    );

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}

      <Card title="Как ты сейчас?">
        <View style={styles.grid}>
          {EMOTIONS.map((e) => {
            const active = e.key === emotionKey;
            return (
              <Pressable
                key={e.key}
                onPress={() => pick(e.key)}
                style={({ pressed }) => [
                  styles.tile,
                  active && { backgroundColor: `${e.color}33`, borderColor: e.color },
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text style={styles.tileEmoji}>{e.emoji}</Text>
                <Text style={[styles.tileLabel, active && { color: C.text, fontWeight: '700' }]} numberOfLines={1}>
                  {e.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {selected ? (
          <>
            <Txt muted size={14}>
              Точнее (необязательно):
            </Txt>
            <View style={styles.chips}>
              {selected.subs.map((s) => (
                <Chip key={s} label={s} selected={s === sub} color={selected.color} onPress={() => setSub(s === sub ? null : s)} />
              ))}
            </View>

            <Txt muted size={14}>
              Интенсивность: {intensity} — {INTENSITY_LABELS[intensity]}
            </Txt>
            <Row gap={S.sm}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setIntensity(n)}
                  style={[
                    styles.level,
                    { borderColor: selected.color },
                    n <= intensity && { backgroundColor: selected.color },
                  ]}
                >
                  <Text style={[styles.levelText, n <= intensity && { color: '#14141A' }]}>{n}</Text>
                </Pressable>
              ))}
            </Row>

            <Input placeholder="Заметка (необязательно)" value={note} onChangeText={setNote} multiline maxLength={1000} />
            <Button title={`Сохранить ${selected.emoji}`} onPress={save} loading={busy} />
          </>
        ) : (
          <Txt muted size={14}>
            Выберите эмоцию. Отмечать можно несколько раз в день.
          </Txt>
        )}
      </Card>

      <Card title="Сегодня">
        {(data ?? []).length === 0 ? <Empty text="Отметок пока нет" /> : null}
        {(data ?? []).map((m) => {
          const e = getEmotion(m.emotion);
          const mine = m.user_id === me.id;
          const who = mine ? 'Ты' : partner?.display_name ?? 'Партнёр';
          return (
            <Pressable key={m.id} onLongPress={mine ? () => remove(m) : undefined} style={styles.entry}>
              <Text style={styles.entryEmoji}>{e.emoji}</Text>
              <View style={styles.flex}>
                <Row style={styles.between}>
                  <Txt bold>
                    {e.label}
                    {m.sub_emotion ? <Txt muted> · {m.sub_emotion}</Txt> : null}
                  </Txt>
                  <Txt muted size={12}>
                    {formatTime(m.created_at)}
                  </Txt>
                </Row>
                <Row gap={S.sm}>
                  <Txt size={12} color={mine ? C.me : C.partner}>
                    {who}
                  </Txt>
                  <Dots value={m.intensity} color={e.color} />
                </Row>
                {m.note ? (
                  <Txt muted size={14}>
                    {m.note}
                  </Txt>
                ) : null}
              </View>
            </Pressable>
          );
        })}
        {(data ?? []).some((m) => m.user_id === me.id) ? (
          <Txt muted size={12} style={styles.hint}>
            Удержите свою отметку, чтобы удалить её
          </Txt>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  between: { justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: S.sm },
  tile: {
    width: '32%',
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card2,
    paddingVertical: S.md,
    alignItems: 'center',
    gap: 4,
  },
  tileEmoji: { fontSize: 28 },
  tileLabel: { color: C.muted, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  level: {
    flex: 1,
    height: 40,
    borderRadius: R.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelText: { color: C.text, fontWeight: '700', fontSize: 16 },
  entry: { flexDirection: 'row', gap: S.md, paddingVertical: 6 },
  entryEmoji: { fontSize: 28 },
  hint: { textAlign: 'center' },
});

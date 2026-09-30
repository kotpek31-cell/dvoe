// Настроение: у каждой эмоции свой ползунок и своё лицо. Сохраняется «смесь» эмоций 0…100.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Confetti } from '../../src/components/Effects';
import { EmotionSlider } from '../../src/components/EmotionSlider';
import { Face } from '../../src/components/Face';
import { Button, Card, Chip, Empty, ErrorBox, GroupLabel, Input, Pill, Screen, showError, Txt } from '../../src/components/ui';
import { usePair, useTableVersion } from '../../src/context/PairProvider';
import { addMood, deleteMood, fetchMoods } from '../../src/lib/api';
import { formatDayLong, formatTime, todayKey } from '../../src/lib/dates';
import { confirmAction } from '../../src/lib/dialogs';
import {
  EMOTIONS,
  entryMix,
  mixDominant,
  mixLabels,
  mixScore,
  mixSummary,
  mixTop,
  scoreColor,
  type EmotionKey,
  type MoodMix,
} from '../../src/lib/emotions';
import { useLoader } from '../../src/lib/hooks';
import { haptic, useReducedMotion } from '../../src/lib/motion';
import { formatScore } from '../../src/lib/score';
import { refreshWidgets } from '../../src/lib/widgets';
import { C, S } from '../../src/theme';
import type { MoodEntry } from '../../src/types';

const LIGHT = EMOTIONS.filter((e) => e.group === 'light');
const HEAVY = EMOTIONS.filter((e) => e.group === 'heavy');

export default function MoodScreen() {
  const { me, partner } = usePair();
  const day = todayKey();
  const version = useTableVersion('mood_entries');
  const { data, loading, refreshing, error, refresh, reload } = useLoader(() => fetchMoods(day, day), [day, version]);
  const reduce = useReducedMotion();

  const [mix, setMix] = useState<MoodMix>({});
  const [subs, setSubs] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const [needSlide, setNeedSlide] = useState(false);
  const [saveWidth, setSaveWidth] = useState(320);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const all = timers.current;
    return () => all.forEach((t) => clearTimeout(t));
  }, []);

  const onSlide = useCallback((key: EmotionKey, value: number) => {
    setMix((prev) => ({ ...prev, [key]: value }));
  }, []);

  const top = useMemo(() => mixTop(mix), [mix]);
  const dominant = top[0] ?? null;
  const score = mixScore(mix);

  // Уточнения показываем для главной эмоции; при смене главной сбрасываем
  const dominantKey = dominant?.key ?? null;
  const lastDominant = useRef<EmotionKey | null>(null);
  useEffect(() => {
    if (lastDominant.current !== dominantKey) {
      lastDominant.current = dominantKey;
      setSubs([]);
    }
  }, [dominantKey]);

  // После сохранения лица плавно «успокаиваются» до нуля
  const calmDown = () => {
    if (reduce) {
      setMix({});
      return;
    }
    let step = 0;
    const tick = setInterval(() => {
      step += 1;
      setMix((prev) => {
        const next: MoodMix = {};
        (Object.keys(prev) as EmotionKey[]).forEach((k) => {
          const v = Math.round((prev[k] ?? 0) * 0.6);
          if (v > 2) next[k] = v;
        });
        return next;
      });
      if (step >= 8) clearInterval(tick);
    }, 45);
    timers.current.push(tick);
  };

  const save = async () => {
    if (!dominant) {
      haptic.light();
      setNeedSlide(true);
      timers.current.push(setTimeout(() => setNeedSlide(false), 2200));
      return;
    }
    setBusy(true);
    try {
      await addMood({ day, mix, subs, note: note || null });
      haptic.success();
      setConfetti((n) => n + 1);
      setSaved(true);
      setNote('');
      timers.current.push(setTimeout(() => setSaved(false), 2200));
      timers.current.push(setTimeout(calmDown, 700));
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
      'Удалить отметку?',
      `${mixLabels(entryMix(entry))}, ${formatTime(entry.created_at)}`,
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

  if (!me) return null;

  const entries = data ?? [];
  const partnerLast = partner ? entries.find((m) => m.user_id === partner.id) ?? null : null;
  const partnerTop = partnerLast ? mixDominant(entryMix(partnerLast)) : null;

  return (
    <Screen
      tabs
      title="Настроение"
      subtitle={formatDayLong(day)}
      refreshing={refreshing}
      onRefresh={refresh}
      right={
        partner ? (
          <Pill style={styles.partnerPill}>
            <Face emotion={partnerTop?.key ?? 'calm'} value={partnerTop?.value ?? 0} size={30} />
            <View>
              <Txt weight="heavy" size={12} color={C.partner} numberOfLines={1}>
                {partner.display_name}
              </Txt>
              <Txt weight="bold" size={12} muted>
                {partnerLast ? `${formatScore(mixScore(entryMix(partnerLast)))} · ${formatTime(partnerLast.created_at)}` : 'пока нет'}
              </Txt>
            </View>
          </Pill>
        ) : null
      }
    >
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}

      <Card style={styles.hero}>
        <Face emotion={dominant?.key ?? 'calm'} value={dominant?.value ?? 0} size={104} blink />
        <View style={styles.heroText}>
          <Txt weight="bold" size={13} muted>
            Сейчас
          </Txt>
          <View style={styles.scoreRow}>
            <Txt weight="display" size={38} style={styles.scoreNum}>
              {formatScore(score)}
            </Txt>
            <Txt weight="bold" size={15} faint>
              из 10
            </Txt>
          </View>
          <Txt weight="heavy" size={15} color={dominant?.emotion.color ?? C.muted} numberOfLines={2}>
            {dominant ? mixSummary(mix) : 'Двигай ползунки — лицо покажет'}
          </Txt>
          <View style={styles.mixBar}>
            {top.map((t) => (
              <View key={t.key} style={{ flex: t.value, backgroundColor: t.emotion.color }} />
            ))}
          </View>
        </View>
      </Card>

      <Card title="Что внутри" right={top.length ? <Button title="Сбросить" variant="ghost" small onPress={() => setMix({})} /> : null}>
        <View>
          <GroupLabel text="Светлое" />
          {LIGHT.map((e) => (
            <EmotionSlider key={e.key} emotion={e} value={mix[e.key] ?? 0} onChange={onSlide} />
          ))}
          <View style={styles.groupGap} />
          <GroupLabel text="Непростое" />
          {HEAVY.map((e) => (
            <EmotionSlider key={e.key} emotion={e} value={mix[e.key] ?? 0} onChange={onSlide} />
          ))}
        </View>
      </Card>

      <Card>
        {dominant ? (
          <View style={styles.block}>
            <Txt weight="heavy" size={15}>
              {dominant.emotion.label} — а точнее?
            </Txt>
            <View style={styles.chips}>
              {dominant.emotion.subs.map((sub) => (
                <Chip
                  key={sub}
                  label={sub}
                  color={dominant.emotion.color}
                  selected={subs.includes(sub)}
                  onPress={() => setSubs((prev) => (prev.includes(sub) ? prev.filter((x) => x !== sub) : [...prev, sub]))}
                />
              ))}
            </View>
          </View>
        ) : null}
        <View style={styles.block}>
          <Txt weight="heavy" size={15}>
            Пара слов
          </Txt>
          <Input
            placeholder={partner ? `Что случилось? ${partner.display_name} тоже увидит` : 'Что случилось?'}
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={1000}
            accessibilityLabel="Заметка к настроению"
          />
        </View>
        <View onLayout={(e) => setSaveWidth(e.nativeEvent.layout.width)}>
          <Button
            title={
              saved
                ? partner
                  ? `Сохранено — ${partner.display_name} увидит`
                  : 'Сохранено'
                : needSlide
                  ? 'Подвинь хотя бы один ползунок'
                  : 'Сохранить'
            }
            variant={saved ? 'success' : 'primary'}
            icon={saved ? 'check' : undefined}
            onPress={save}
            loading={busy}
          />
          <Confetti trigger={confetti} colors={top.map((t) => t.emotion.color)} width={saveWidth} />
        </View>
      </Card>

      <Card title="Сегодня">
        {entries.length === 0 ? <Empty text="Отметок пока нет" /> : null}
        {entries.map((m, i) => {
          const entryTop = mixTop(entryMix(m));
          const mine = m.user_id === me.id;
          const s = mixScore(entryMix(m));
          return (
            <Pressable
              key={m.id}
              onLongPress={mine ? () => remove(m) : undefined}
              style={[styles.entry, i > 0 ? styles.entryBorder : null]}
              accessibilityHint={mine ? 'Удержите, чтобы удалить' : undefined}
            >
              <View style={styles.faces}>
                {entryTop.slice(0, 3).map((t, j) => (
                  <View key={t.key} style={[styles.faceStack, { left: j * 20, zIndex: 3 - j }]}>
                    <Face emotion={t.key} value={t.value} size={36} />
                  </View>
                ))}
              </View>
              <View style={styles.entryText}>
                <Txt weight="heavy" size={14} color={mine ? C.me : C.partner}>
                  {mine ? 'Ты' : partner?.display_name ?? 'Партнёр'}
                  <Txt weight="bold" size={13} faint>
                    {'  '}
                    {formatTime(m.created_at)}
                  </Txt>
                </Txt>
                <Txt weight="bold" size={13} muted numberOfLines={1}>
                  {mixLabels(entryMix(m))}
                  {m.sub_emotion ? ` · ${m.sub_emotion}` : ''}
                </Txt>
                {m.note ? (
                  <Txt size={13} faint numberOfLines={2} style={styles.italic}>
                    «{m.note}»
                  </Txt>
                ) : null}
              </View>
              <View style={[styles.score, { backgroundColor: scoreColor(s) ?? C.glassStrong }]}>
                <Txt weight="displaySemi" size={13}>
                  {formatScore(s)}
                </Txt>
              </View>
            </Pressable>
          );
        })}
        {entries.some((m) => m.user_id === me.id) ? (
          <Txt faint size={12} center>
            Удержите свою отметку, чтобы удалить её
          </Txt>
        ) : null}
      </Card>

      {loading && !data ? <Empty text="Загружаем…" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  partnerPill: { paddingLeft: 5, paddingRight: 12, minHeight: 46, borderRadius: 23 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: S.lg },
  heroText: { flex: 1, gap: 4 },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  scoreNum: { lineHeight: 44 },
  mixBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 4 },
  groupGap: { height: 6 },
  block: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  entryBorder: { borderTopWidth: 1, borderTopColor: C.border },
  faces: { width: 76, height: 36 },
  faceStack: { position: 'absolute', top: 0 },
  entryText: { flex: 1, gap: 2 },
  italic: { fontStyle: 'italic' },
  score: { minWidth: 46, height: 30, paddingHorizontal: 8, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});

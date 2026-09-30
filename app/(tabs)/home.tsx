// Главная: только чибики на локации. Нажатие на чибика партнёра = «Думаю о тебе».
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chibi } from '../../src/components/Chibi';
import { HeartsBurst, Snore, Toast } from '../../src/components/Effects';
import { Face } from '../../src/components/Face';
import { Icon } from '../../src/components/Icon';
import { Meadow } from '../../src/components/scene/Meadow';
import { IconButton, Pill, Pressy, Txt } from '../../src/components/ui';
import { Walker } from '../../src/components/Walker';
import { usePair, useTableVersion } from '../../src/context/PairProvider';
import { fetchMoods, fetchStreaks, sendNudge } from '../../src/lib/api';
import { chibiKindOf } from '../../src/lib/chibi';
import { formatTime, plural, toDayKey } from '../../src/lib/dates';
import { entryMix, mixDominant } from '../../src/lib/emotions';
import { errorMessage } from '../../src/lib/env';
import type { FaceKey } from '../../src/lib/face';
import { useScreenFocused } from '../../src/lib/focus';
import { useLoader } from '../../src/lib/hooks';
import { haptic } from '../../src/lib/motion';
import { getFlag, setFlag } from '../../src/lib/prefs';
import { dayTimeOf, sceneTransform } from '../../src/lib/scene';
import { C } from '../../src/theme';
import type { MoodEntry } from '../../src/types';

type FaceState = { emotion: FaceKey; value: number };

// Настроение человека сейчас: главная эмоция последней отметки за сегодня
function currentFace(moods: MoodEntry[], userId: string | undefined): FaceState & { has: boolean; label: string } {
  const last = moods.find((m) => m.user_id === userId);
  const top = last ? mixDominant(entryMix(last)) : null;
  return top
    ? { emotion: top.key, value: top.value, has: true, label: top.emotion.label }
    : { emotion: 'calm', value: 30, has: false, label: 'Пока без отметки' };
}

export default function HomeScreen() {
  const { me, partner, pair, lastNudgeAt } = usePair();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const focused = useScreenFocused();
  const [now, setNow] = useState(() => new Date());
  const day = toDayKey(now);
  const time = dayTimeOf(now);
  const version = useTableVersion('mood_entries', 'profiles', 'sleep_entries');
  const { data } = useLoader(async () => {
    const [moods, streaks] = await Promise.all([fetchMoods(day, day), fetchStreaks(day)]);
    return { moods, streaks };
  }, [day, version]);

  const [toast, setToast] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [bubble, setBubble] = useState(false);
  const [meAct, setMeAct] = useState<'wave' | 'love' | null>(null);
  const [partnerAct, setPartnerAct] = useState(false);
  const [heartsP, setHeartsP] = useState(0);
  const [heartsM, setHeartsM] = useState(0);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastSent = useRef(0);
  const mountedAt = useRef(Date.now());

  const later = (key: string, ms: number, fn: () => void) => {
    if (timers.current[key]) clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(fn, ms);
  };

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30_000);
    getFlag('nudgeHint').then((dismissed) => setHint(!dismissed));
    const all = timers.current;
    return () => {
      clearInterval(tick);
      Object.values(all).forEach(clearTimeout);
    };
  }, []);

  const showToast = (text: string) => {
    setToast(text);
    later('toast', 2800, () => setToast(null));
  };

  // Партнёр прислал «Думаю о тебе», пока приложение открыто
  useEffect(() => {
    if (!lastNudgeAt || lastNudgeAt < mountedAt.current) return;
    setHeartsM((n) => n + 1);
    setMeAct('love');
    setPartnerAct(true);
    showToast(`${partner?.display_name ?? 'Партнёр'} думает о тебе`);
    later('me', 2600, () => setMeAct(null));
    later('partner', 2600, () => setPartnerAct(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastNudgeAt]);

  const tf = useMemo(() => sceneTransform(width, height), [width, height]);
  const size = Math.round(104 * tf.s);
  const chibiH = Math.round((size * 170) / 120);
  const minX = Math.max(8, tf.x(16));
  const maxX = Math.min(width - size - 8, tf.x(270));

  if (!me) return <View style={styles.root} />;

  const moods = data?.moods ?? [];
  const myFace = currentFace(moods, me.id);
  const partnerFace = currentFace(moods, partner?.id);
  const myKind = chibiKindOf(me);
  const partnerKind = chibiKindOf(partner);
  const partnerSleeps = Boolean(partner?.sleeping_since);
  const meSleeps = Boolean(me.sleeping_since);
  const streak = data?.streaks.find((s) => s.user_id === me.id)?.streak ?? 0;
  const partnerName = partner?.display_name ?? 'Партнёр';

  const tapPartner = async () => {
    if (!partner) return;
    haptic.success();
    setHeartsP((n) => n + 1);
    setHint(false);
    setFlag('nudgeHint');
    if (!partnerSleeps) {
      setPartnerAct(true);
      later('partner', 2600, () => setPartnerAct(false));
    }
    if (Date.now() - lastSent.current < 3500) return; // не чаще раза в 3 секунды (так же ограничивает база)
    lastSent.current = Date.now();
    try {
      await sendNudge(me.id);
      showToast(partnerSleeps ? `${partnerName} спит — увидит утром` : `${partnerName} получит «думаю о тебе»`);
    } catch (e) {
      showToast(errorMessage(e));
    }
  };

  const tapMe = () => {
    haptic.light();
    setMeAct('wave');
    setBubble(true);
    later('me', 2600, () => setMeAct(null));
    later('bubble', 6000, () => setBubble(false));
  };

  // Спящие лежат на пледе; если спят оба — рядышком
  const sleepSpot = (who: 'me' | 'partner') => {
    const both = partnerSleeps && meSleeps;
    const center = both ? (who === 'partner' ? { x: 300, y: 626 } : { x: 286, y: 664 }) : { x: 292, y: 640 };
    const k = both ? 0.9 : 1;
    const w = size * k;
    const h = chibiH * k;
    return { left: tf.x(center.x) - w / 2, top: tf.y(center.y) - h / 2, w, h };
  };

  const faceFor = (face: FaceState, act: 'wave' | 'love' | null) =>
    act === 'wave' ? { emotion: 'joy' as FaceKey, value: 80 } : act === 'love' ? { emotion: 'love' as FaceKey, value: 72 } : face;

  const nameTag = (label: string, color: string) => (
    <View pointerEvents="none" style={[styles.tagWrap, { top: chibiH - 2, width: size + 80, left: -40 }]}>
      <View style={styles.tag}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Txt weight="heavy" size={12} numberOfLines={1}>
          {label}
        </Txt>
      </View>
    </View>
  );

  const sleeper = (who: 'me' | 'partner') => {
    const spot = sleepSpot(who);
    const isMe = who === 'me';
    const person = isMe ? me : partner;
    return (
      <View key={`sleep-${who}`} style={{ position: 'absolute', left: spot.left, top: spot.top }}>
        <Pressy
          onPress={isMe ? () => router.push('/sleep') : tapPartner}
          haptics={false}
          scaleTo={0.97}
          accessibilityLabel={isMe ? 'Это ты, ты спишь. Нажми, чтобы открыть сон' : `${partnerName} спит. Нажми — увидит «думаю о тебе» утром`}
        >
          <Chibi kind={isMe ? myKind : partnerKind} emotion="calm" value={0} pose="sleep" size={spot.w} />
        </Pressy>
        <Snore x={spot.w * 0.02} y={spot.h * 0.12} scale={tf.s} />
        {!isMe ? <HeartsBurst trigger={heartsP} x={spot.w / 2} y={spot.h * 0.45} scale={tf.s} /> : null}
        <View pointerEvents="none" style={[styles.tagWrap, { top: spot.h * 0.82, width: spot.w + 120, left: -60 }]}>
          <View style={styles.tag}>
            <View style={[styles.dot, { backgroundColor: isMe ? C.me : C.partner }]} />
            <Txt weight="heavy" size={12} numberOfLines={1}>
              {isMe ? 'ты спишь' : `${partnerName} спит`}
              {person?.sleeping_since ? ` · с ${formatTime(person.sleeping_since)}` : ''}
            </Txt>
          </View>
        </View>
      </View>
    );
  };

  const pFace = faceFor(partnerFace, partnerAct ? 'love' : null);
  const mFace = faceFor(myFace, meAct);

  return (
    <View style={styles.root}>
      <Meadow width={width} height={height} time={time} active={focused} />

      {partner && !partnerSleeps ? (
        <Walker
          kind={partnerKind}
          emotion={pFace.emotion}
          value={pFace.value}
          size={size}
          top={tf.y(520)}
          minX={minX}
          maxX={maxX}
          startX={minX + (maxX - minX) * 0.85}
          speed={34 * tf.s}
          paused={!focused || partnerAct}
          pose={partnerAct ? 'wave' : 'idle'}
          label={`${partnerName}. Нажми — придёт «думаю о тебе»`}
          onPress={tapPartner}
        >
          <View pointerEvents="none" style={[styles.bubbleWrap, { top: -40, width: size + 140, left: -70 }]}>
            <View style={styles.moodBubble}>
              <Face emotion={partnerFace.emotion} value={partnerFace.has ? partnerFace.value : 0} size={26} />
              <Txt weight="heavy" size={12} color={C.ink} numberOfLines={1}>
                {partnerFace.label}
              </Txt>
            </View>
          </View>
          {nameTag(partnerName, C.partner)}
          <HeartsBurst trigger={heartsP} x={size / 2} y={chibiH * 0.36} scale={tf.s} />
        </Walker>
      ) : null}

      {partner && partnerSleeps ? sleeper('partner') : null}
      {meSleeps ? sleeper('me') : null}

      {!meSleeps ? (
        <Walker
          kind={myKind}
          emotion={mFace.emotion}
          value={mFace.value}
          size={size}
          top={tf.y(548)}
          minX={minX}
          maxX={maxX}
          startX={minX + (maxX - minX) * 0.15}
          speed={30 * tf.s}
          paused={!focused || meAct !== null || bubble}
          pose={meAct === 'wave' ? 'wave' : 'idle'}
          label="Это ты. Нажми, чтобы отметить настроение"
          onPress={tapMe}
        >
          {nameTag('ты', C.me)}
          {bubble ? (
            <View pointerEvents="box-none" style={[styles.bubbleWrap, { top: -54, width: 230, left: size / 2 - 115 }]}>
              <View style={styles.askBubble}>
                <Txt weight="heavy" size={14} color={C.ink}>
                  Как ты?
                </Txt>
                <Pressy
                  onPress={() => {
                    setBubble(false);
                    router.push('/mood');
                  }}
                  innerStyle={styles.askButton}
                  accessibilityLabel="Отметить настроение"
                >
                  <Txt weight="heavy" size={13} color={C.onAccent}>
                    Отметить
                  </Txt>
                </Pressy>
              </View>
            </View>
          ) : null}
          <HeartsBurst trigger={heartsM} x={size / 2} y={chibiH * 0.36} scale={tf.s} />
        </Walker>
      ) : null}

      <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <Pill>
          <Icon name="pin" size={17} color="#FFFFFF" />
          <Txt weight="heavy" size={13}>
            Луг у озера
          </Txt>
          <Txt weight="heavy" size={13} color="rgba(255,255,255,0.8)">
            · {formatTime(now)}
          </Txt>
        </Pill>
        {streak > 0 ? (
          <Pill>
            <Icon name="flame" size={17} color="#FFFFFF" fill="#FFB36B" strokeWidth={1.6} />
            <Txt weight="heavy" size={13}>
              {streak} {plural(streak, 'день', 'дня', 'дней')}
            </Txt>
          </Pill>
        ) : null}
      </View>

      {!partner ? (
        <View style={[styles.card, { top: insets.top + 56 }]}>
          <Txt weight="heavy" size={15}>
            Пригласи партнёра
          </Txt>
          <Txt size={14} color="rgba(255,255,255,0.85)">
            Отправь код пары — второй чибик появится здесь, как только партнёр его введёт.
          </Txt>
          {pair ? (
            <View style={styles.codeRow}>
              <Txt weight="display" size={24} color={C.accent} style={styles.code}>
                {pair.invite_code}
              </Txt>
              <IconButton
                icon="share"
                label="Поделиться кодом"
                onPress={() =>
                  Share.share({ message: `Давай вести общий дневник в «Двое». Мой код пары: ${pair.invite_code}` }).catch(() => undefined)
                }
              />
            </View>
          ) : null}
        </View>
      ) : hint && !partnerSleeps && !toast ? (
        <View style={[styles.hint, { top: insets.top + 56 }]}>
          <View style={styles.hintIcon}>
            <Icon name="heart" size={18} color={C.accent} fill={C.accent} />
          </View>
          <Txt weight="bold" size={14} style={styles.flex}>
            Нажми на второго чибика — {partnerName} получит «думаю о тебе»
          </Txt>
          <IconButton
            icon="close"
            label="Скрыть подсказку"
            size={38}
            tint="transparent"
            onPress={() => {
              setHint(false);
              setFlag('nudgeHint');
            }}
          />
        </View>
      ) : null}

      <Toast text={toast} top={insets.top + 58} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#6FB7F5', overflow: 'hidden' },
  flex: { flex: 1 },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tagWrap: { position: 'absolute', alignItems: 'center' },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(24,18,40,0.56)',
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  bubbleWrap: { position: 'absolute', alignItems: 'center' },
  moodBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 11,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  askBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingLeft: 14,
    paddingRight: 4,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 8px 20px rgba(20,10,40,0.22)',
  },
  askButton: { height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: C.accent, justifyContent: 'center' },
  card: {
    position: 'absolute',
    left: 16,
    right: 16,
    padding: 16,
    gap: 8,
    borderRadius: 24,
    backgroundColor: 'rgba(24,18,40,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code: { letterSpacing: 4 },
  hint: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 4,
    borderRadius: 22,
    backgroundColor: 'rgba(24,18,40,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  hintIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,107,138,0.3)',
  },
});

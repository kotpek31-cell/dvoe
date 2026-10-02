// Игра поверх экрана: счёт и таймер, подсказки, фонарь «Реакции» (жми куда угодно), выбор руки в КНБ,
// «Финиш!». Звуки событий игры — здесь же (сравниваем прошлый снимок с новым).
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { RPS, type Action, type GamePub, type Hand, type ReactionPub, type RpsPub, type StarsPub, HANDS, placesOf } from '../../../lib/games/rules';
import type { GameSnap } from '../../../lib/games/host';
import { haptic, nativeDriver } from '../../../lib/motion';
import { playSound } from '../../../lib/sound';
import { C, F } from '../../../theme';
import { Pressy, Txt } from '../../ui';
import { HAND_NAME, HandArt } from './art';
import { GAME_COLOR, GAME_NAME } from './PreGame';

type Props = {
  snap: GameSnap;
  toLocal: (t: number) => number;
  meId: string | null;
  nameOf: (m: string) => string;
  colorOf: (m: string) => string;
  width: number;
  height: number;
  top: number;
  bottom: number;
  reduce: boolean;
  act: (a: Action) => void;
};

const secs = (ms: number) => `${(ms / 1000).toFixed(2).replace('.', ',')} с`;
const BEAT_TEXT: Record<Hand, string> = { rock: 'Камень бьёт ножницы', scissors: 'Ножницы режут бумагу', paper: 'Бумага накрывает камень' };
export const listNames = (names: string[]) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} и ${names[names.length - 1]}`);

export function GameHud(p: Props) {
  useGameSounds(p.snap, p.meId);
  const st = p.snap.st;
  if (!st) return null;
  if (p.snap.phase === 'end') return <EndBanner {...p} st={st} />;
  if (p.snap.phase !== 'play') return null;
  if (st.g === 'stars') return <StarsHud {...p} st={st} />;
  if (st.g === 'pumpkin') {
    const me = p.meId;
    const out = me ? st.out.includes(me) : false;
    const text =
      st.phase === 'boom' && st.boomed
        ? `Бах! ${st.boomed === me ? 'Ты выбываешь' : `${p.nameOf(st.boomed)} выбывает`}`
        : out
          ? 'Ты вне игры — смотри, кто победит'
          : st.holder === me
            ? 'Тыква у тебя! Нажми на соседа'
            : st.holder
              ? `С тыквой: ${p.nameOf(st.holder)}`
              : '';
    return (
      <View pointerEvents="none" style={[styles.top, { top: p.top + 58 }]}>
        <Pill text={`${GAME_NAME.pumpkin} · раунд ${st.round}`} color={GAME_COLOR.pumpkin} />
        {text ? <Hint text={text} color={st.holder === me && st.phase === 'hold' ? C.warn : C.text} /> : null}
      </View>
    );
  }
  if (st.g === 'reaction') return <ReactionHud {...p} st={st} />;
  return <RpsHud {...p} st={st} />;
}

function Pill({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Txt weight="heavy" size={14} color={color} numberOfLines={1}>
        {text}
      </Txt>
    </View>
  );
}

// Подсказка на стекле — читается и на светлом небе
function Hint({ text, color = C.text, size = 14 }: { text: string; color?: string; size?: number }) {
  return (
    <View style={styles.hint}>
      <Txt weight="heavy" size={size} center color={color}>
        {text}
      </Txt>
    </View>
  );
}

function Chips({ items }: { items: { id: string; name: string; color: string; value: string; dim?: boolean }[] }) {
  return (
    <View style={styles.chips}>
      {items.map((it) => (
        <View key={it.id} style={[styles.chip, { borderColor: it.color, opacity: it.dim ? 0.5 : 1 }]}>
          <Txt weight="heavy" size={13} numberOfLines={1}>
            {it.name}
          </Txt>
          <Txt weight="display" size={13} color={it.color}>
            {it.value}
          </Txt>
        </View>
      ))}
    </View>
  );
}

function useNow(every: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(t);
  }, [every]);
  return now;
}

// ---------- Звездопад ----------
function StarsHud({ st, toLocal, nameOf, colorOf, top, bottom, meId }: Props & { st: StarsPub }) {
  const now = useNow(250);
  const left = Math.max(0, toLocal(st.end) - now);
  const sec = Math.ceil(left / 1000);
  const items = [...st.players]
    .sort((a, b) => (st.scores[b] ?? 0) - (st.scores[a] ?? 0))
    .map((m) => ({ id: m, name: nameOf(m), color: colorOf(m), value: String(st.scores[m] ?? 0), dim: st.out.includes(m) }));
  const stunned = meId ? toLocal(st.stun[meId] ?? 0) > now : false;
  return (
    <>
      <View pointerEvents="none" style={[styles.top, { top: top + 54 }]}>
        <View style={styles.hint}>
          <Txt weight="display" size={22} center color={sec <= 5 ? C.warn : C.text}>
            {`0:${String(sec).padStart(2, '0')}`}
          </Txt>
        </View>
        <Chips items={items} />
        {stunned ? <Hint text="Оглушило тучкой!" color={C.warn} /> : null}
      </View>
      <View pointerEvents="none" style={[styles.bottomHint, { bottom: Math.max(bottom, 10) + 14 }]}>
        <Hint text="Беги к тени · золотая +3 · тучка оглушает" size={13} />
      </View>
    </>
  );
}

// ---------- Реакция ----------
function ReactionHud({ st, toLocal, meId, act, nameOf, colorOf, top, bottom, width, height }: Props & { st: ReactionPub }) {
  const alive = Boolean(meId && st.alive.includes(meId));
  const greenRef = useRef(toLocal(st.greenAt));
  greenRef.current = toLocal(st.greenAt);
  const [green, setGreen] = useState(false);
  const shownAt = useRef(0);
  const [mine, setMine] = useState<{ r: number; ms: number | null } | null>(null);
  useEffect(() => {
    setGreen(false);
    if (st.phase !== 'wait') return;
    const t = setTimeout(
      () => {
        shownAt.current = Date.now();
        setGreen(true);
      },
      Math.max(0, greenRef.current - Date.now()),
    );
    return () => clearTimeout(t);
  }, [st.round, st.phase]);

  const answered = mine?.r === st.round;
  const tap = () => {
    if (!alive || st.phase !== 'wait' || answered) return;
    if (!green) {
      setMine({ r: st.round, ms: null });
      act({ k: 'tap', r: st.round, ms: null });
      playSound('buzz', 0.35);
      haptic.warning();
      return;
    }
    const ms = Date.now() - shownAt.current;
    setMine({ r: st.round, ms });
    act({ k: 'tap', r: st.round, ms });
    haptic.medium();
  };

  const lamp = st.phase === 'wait' ? (green ? '#5ED3A0' : '#E5566B') : '#FFD45E';
  const size = Math.min(130, width * 0.32);
  const items = st.players.map((m) => ({ id: m, name: nameOf(m), color: colorOf(m), value: String(st.points[m] ?? 0), dim: st.out.includes(m) }));
  let line = '';
  if (st.phase === 'result') {
    const a = st.winner ? st.answers[st.winner] : null;
    line = st.winner && typeof a === 'number' ? `Раунд — ${st.winner === meId ? 'тебе' : nameOf(st.winner)}: ${secs(a)}` : 'Никто не успел';
  } else if (answered) {
    line = mine?.ms === null ? 'Фальстарт! Раунд проигран' : `Твоё время: ${secs(mine!.ms!)}`;
  } else if (alive) {
    line = green ? 'Жми!' : 'Жди зелёный…';
  } else line = 'Смотришь';

  return (
    <>
      {/* касание засчитывается в момент прикосновения: у Pressable в вебе задержка 50 мс, а короткое касание теряется */}
      {alive ? (
        <View
          style={StyleSheet.absoluteFill}
          onStartShouldSetResponder={() => true}
          onResponderGrant={tap}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Жми, когда фонарь станет зелёным"
          onAccessibilityTap={tap}
        />
      ) : null}
      <View pointerEvents="none" style={[styles.top, { top: top + 54 }]}>
        <Pill text={`Реакция · раунд ${st.round} из 5`} color={GAME_COLOR.reaction} />
        <Chips items={items} />
      </View>
      <View pointerEvents="none" style={[styles.lampWrap, { top: top + 150, left: width / 2 - size }]}>
        <View style={[styles.lampGlow, { width: size * 2, height: size * 2, borderRadius: size, backgroundColor: lamp }]} />
        <View style={[styles.lamp, { width: size, height: size, borderRadius: size / 2, left: size / 2, top: size / 2, backgroundColor: lamp }]}>
          <View style={[styles.lampShine, { width: size * 0.22, height: size * 0.22, borderRadius: size * 0.11, left: size * 0.2, top: size * 0.2 }]} />
        </View>
        <View style={[styles.pole, { left: size - 6, top: size * 1.5 - 2, height: Math.max(40, height * 0.12) }]} />
      </View>
      <View pointerEvents="none" style={[styles.bottomHint, { bottom: Math.max(bottom, 10) + 20 }]}>
        <View style={styles.hint}>
          <Txt weight="display" size={19} center color={st.phase !== 'wait' ? C.text : answered && mine?.ms === null ? C.warn : green ? C.good : C.text}>
            {line}
          </Txt>
        </View>
      </View>
    </>
  );
}

// ---------- Камень, ножницы, бумага ----------
function RpsHud({ st, toLocal, meId, act, nameOf, top, bottom, width, reduce }: Props & { st: RpsPub }) {
  const now = useNow(100);
  const me = meId ?? '';
  const alive = st.alive.includes(me);
  const [mine, setMine] = useState<{ r: number; h: Hand } | null>(null);
  const chosen = mine?.r === st.round ? mine.h : null;

  // «Камень, ножницы, бумага, раз!» — барабан на каждое слово
  const chantEnd = toLocal(st.chantEnd);
  useEffect(() => {
    if (st.phase !== 'chant') return;
    const start = Date.now();
    const timers = [0, 1, 2].map((k) => setTimeout(() => playSound('drum', 0.8), Math.max(0, chantEnd - RPS.CHANT_MS + k * 600 - start)));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.phase, st.round]);

  const pick = (h: Hand) => {
    if (!alive || st.phase !== 'choose') return;
    setMine({ r: st.round, h });
    act({ k: 'pick', r: st.round, h });
  };

  if (st.phase === 'chant') {
    const k = Math.min(3, Math.max(0, Math.floor((now - (chantEnd - RPS.CHANT_MS)) / 600)));
    const word = ['Камень…', 'ножницы…', 'бумага…', 'Раз!'][k];
    return (
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
        <ChantWord key={k} text={word} big={k === 3} reduce={reduce} />
      </View>
    );
  }

  if (st.phase === 'reveal' && st.shown) {
    const hands = Object.values(st.shown);
    let head: string;
    if (st.result === 'draw') head = new Set(hands).size === 1 ? `Все показали: ${HAND_NAME[hands[0]].toLowerCase()} — ещё раз` : 'Все три разных — ещё раз';
    else head = BEAT_TEXT[st.result as Hand];
    const lost = st.lost.map((m) => (m === me ? 'ты' : nameOf(m)));
    const sub =
      st.result === 'draw'
        ? 'Переигровка тем же составом'
        : st.alive.length === 1
          ? `${st.alive[0] === me ? 'Ты побеждаешь' : `${nameOf(st.alive[0])} побеждает`}!`
          : `${listNames(lost)} ${st.lost.length > 1 ? 'выбывают' : st.lost[0] === me ? 'выбываешь' : 'выбывает'} · дальше ${listNames(st.alive.map((m) => (m === me ? 'ты' : nameOf(m))))}`;
    return (
      <View pointerEvents="none" style={[styles.card, { bottom: Math.max(bottom, 10) + 16 }]}>
        <Txt weight="display" size={16} center>
          {head}
        </Txt>
        <Txt weight="bold" size={13} muted center>
          {sub}
        </Txt>
      </View>
    );
  }

  // выбор
  const left = Math.max(0, toLocal(st.chooseEnd) - now);
  const btn = Math.min(96, (width - 32 - 24) / 3);
  return (
    <>
      <View pointerEvents="none" style={[styles.top, { top: top + 54 }]}>
        <Pill text={`Камень, ножницы, бумага · раунд ${st.round}`} color={GAME_COLOR.rps} />
        <View style={styles.timeBar}>
          <View style={[styles.timeFill, { width: `${Math.round((left / RPS.CHOOSE_MS) * 100)}%` }]} />
        </View>
        <Hint text={!alive ? 'Ты вне игры — смотри' : chosen ? `Твой выбор: ${HAND_NAME[chosen].toLowerCase()}` : `Выбирай: ${Math.ceil(left / 1000)} с`} />
      </View>
      {alive ? (
        <View style={[styles.hands, { bottom: Math.max(bottom, 10) + 14 }]}>
          {HANDS.map((h) => (
            <Pressy
              key={h}
              onPress={() => pick(h)}
              style={{ width: btn }}
              scaleTo={0.9}
              innerStyle={[styles.handBtn, { width: btn, height: btn + 22 }, chosen === h ? styles.handOn : null]}
              accessibilityLabel={HAND_NAME[h]}
              accessibilityState={{ selected: chosen === h }}
            >
              <HandArt hand={h} size={btn - 22} bubble={false} />
              <Txt weight="heavy" size={13} color={chosen === h ? C.onAccent : C.text}>
                {HAND_NAME[h]}
              </Txt>
            </Pressy>
          ))}
        </View>
      ) : null}
    </>
  );
}

function ChantWord({ text, big, reduce }: { text: string; big: boolean; reduce: boolean }) {
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (!reduce) Animated.spring(v, { toValue: 1, useNativeDriver: nativeDriver, speed: 20, bounciness: 12 }).start();
  }, [v, reduce]);
  return (
    <Animated.Text style={[styles.chant, { fontSize: big ? 64 : 40, opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1.6, 1] }) }] }]}>
      {text}
    </Animated.Text>
  );
}

// ---------- Финиш ----------
function EndBanner({ st, nameOf, meId, height, reduce }: Props & { st: GamePub }) {
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (!reduce) Animated.timing(v, { toValue: 1, duration: 420, easing: Easing.out(Easing.back(2)), useNativeDriver: nativeDriver }).start();
  }, [v, reduce]);
  const win = placesOf(st)[0];
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,5,18,0.3)' }]}>
      <Animated.View style={[styles.endWrap, { top: height * 0.3, opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
        <Txt weight="display" size={40} center color="#FFD45E" style={styles.bigShadow}>
          {st.g === 'stars' ? 'Время!' : 'Финиш!'}
        </Txt>
        {win ? <Hint text={win === meId ? 'Ты побеждаешь!' : `Побеждает ${nameOf(win)}`} size={16} /> : null}
      </Animated.View>
    </View>
  );
}

// ---------- Звуки событий ----------
function useGameSounds(snap: GameSnap, me: string | null) {
  const prev = useRef<GameSnap | null>(null);
  useEffect(() => {
    const a = prev.current;
    prev.current = snap;
    if (!a || a.id !== snap.id || !snap.st || !a.st) return;
    const s = snap.st;
    const o = a.st;
    if (s.g === 'pumpkin' && o.g === 'pumpkin') {
      if (s.passAt !== o.passAt && s.from) playSound('whoosh', 0.6);
      if (s.boomAt !== o.boomAt && s.boomed) {
        playSound('boom', 0.5);
        if (s.boomed === me) haptic.warning();
      }
      if (s.holder === me && o.holder !== me) haptic.light();
    }
    if (s.g === 'stars' && o.g === 'stars') {
      Object.entries(s.taken).forEach(([i, m]) => {
        if (o.taken[Number(i)] !== undefined) return;
        const gold = (s.scores[m] ?? 0) - (o.scores[m] ?? 0) > 1;
        playSound(gold ? 'coin' : 'ding', m === me ? 0.9 : 0.3);
        if (m === me) haptic.light();
      });
      if (me && (s.stun[me] ?? 0) !== (o.stun[me] ?? 0)) {
        playSound('zap', 0.6);
        haptic.warning();
      }
    }
    if (s.g === 'reaction' && o.g === 'reaction' && o.phase === 'wait' && s.phase === 'result' && s.winner) {
      playSound('ding', s.winner === me ? 0.9 : 0.35);
    }
    if (s.g === 'rps' && o.g === 'rps' && o.phase !== 'reveal' && s.phase === 'reveal') playSound('pop', 0.8);
  }, [snap]);
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', left: 16, right: 16, alignItems: 'center', gap: 8 },
  pill: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 18, borderWidth: 1.4, backgroundColor: 'rgba(24,18,40,0.82)', maxWidth: '100%' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 32, borderRadius: 16, borderWidth: 1.4, backgroundColor: 'rgba(24,18,40,0.8)', maxWidth: 170 },
  shadowText: { textShadowColor: '#2B2035', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  bigShadow: { textShadowColor: '#2B2035', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 8 },
  bottomHint: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  hint: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(24,18,40,0.8)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', maxWidth: '100%' },
  lampWrap: { position: 'absolute', width: 0, height: 0 },
  lampGlow: { position: 'absolute', left: 0, top: 0, opacity: 0.2 },
  lamp: { position: 'absolute', borderWidth: 3, borderColor: '#2B2035' },
  lampShine: { position: 'absolute', backgroundColor: '#FFFFFF', opacity: 0.4 },
  pole: { position: 'absolute', width: 12, backgroundColor: '#3A3346', borderWidth: 2, borderColor: '#2B2035', borderRadius: 3 },
  card: { position: 'absolute', left: 24, right: 24, paddingVertical: 14, paddingHorizontal: 16, gap: 4, borderRadius: 22, backgroundColor: 'rgba(28,23,48,0.92)', borderWidth: 1, borderColor: C.glassBorder },
  timeBar: { width: 200, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' },
  timeFill: { height: 8, borderRadius: 4, backgroundColor: GAME_COLOR.rps },
  hands: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'center', gap: 12 },
  handBtn: { borderRadius: 26, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: 'rgba(24,18,40,0.86)', borderWidth: 1.4, borderColor: 'rgba(255,255,255,0.18)' },
  handOn: { backgroundColor: C.accent, borderColor: C.accent },
  chant: { fontFamily: F.display, color: '#FFFFFF', textShadowColor: '#2B2035', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 8 },
  endWrap: { position: 'absolute', left: 24, right: 24, gap: 8, alignItems: 'center' },
});

// Стенд: живой просмотр главной 3.0 — настоящие компоненты приложения (локация, чибики, эффекты, сцены способностей).
// Нажми на землю — чибик идёт; на чибиков — сердечки и приветствие; сверху — место и время суток; справа — способности.
// Это не приложение целиком (нет входа, базы, пушей) — только графика.
import { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Animated, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { HeartsBurst, Ripple, SparkPop, Toast } from '../../../src/components/Effects';
import { Icon } from '../../../src/components/Icon';
import { TabBar } from '../../../src/components/TabBar';
import { Walker } from '../../../src/components/Walker';
import { AbilityScene, worldTransform } from '../../../src/components/scene/AbilityScene';
import { Location } from '../../../src/components/scene/Location';
import { IconButton, Pill, Pressy, Txt } from '../../../src/components/ui';
import { LOOKS, type Look } from '../../../src/lib/chibi';
import { LOCATION_BG, LOCATIONS } from '../../../src/lib/locations';
import { NightContext } from '../../../src/lib/night';
import { sceneTransform, type DayTime } from '../../../src/lib/scene';
import { C } from '../../../src/theme';

const artist: Look = { kind: 'girl', skin: 1, hair: { id: 'hair.long', c: 'pink' }, eyes: { id: 'eyes.lashes' }, hat: { id: 'hat.beret' }, top: { id: 'top.apron' }, bottom: { id: 'bottom.skirt' }, shoes: { id: 'shoes.sapozhki' }, hand: { id: 'hand.brush' } };
const angel: Look = { ...LOOKS.nb, hat: { id: 'hat.halo' }, back: { id: 'back.wings' }, top: { id: 'top.sweater' } };
const MINE: { name: string; look: Look }[] = [
  { name: 'Худи', look: LOOKS.boy },
  { name: 'Ангел', look: angel },
  { name: 'Мята', look: LOOKS.nb },
];
const HERS: { name: string; look: Look }[] = [
  { name: 'Художница', look: artist },
  { name: 'Платье', look: LOOKS.girl },
];
const TIMES: { id: DayTime; label: string }[] = [
  { id: 'day', label: 'День' },
  { id: 'evening', label: 'Вечер' },
  { id: 'night', label: 'Ночь' },
];
const ROUTES = ['home', 'mood', 'sleep', 'us', 'stats', 'profile'].map((name) => ({ name, key: name, params: undefined }));
const NAV = { emit: () => ({ defaultPrevented: false }), navigate: () => undefined };

function Page() {
  const { width, height } = useWindowDimensions();
  const tf = useMemo(() => sceneTransform(width, height), [width, height]);
  const size = Math.round(104 * tf.s);
  const chibiH = Math.round((size * 170) / 120);
  const minX = Math.max(8, tf.x(16));
  const maxX = Math.min(width - size - 8, tf.x(270));
  const minTop = tf.y(498);
  const maxTop = tf.y(590);

  const [loc, setLoc] = useState(0);
  const [time, setTime] = useState<DayTime>('day');
  const [mine, setMine] = useState(0);
  const [hers, setHers] = useState(0);
  const [goMe, setGoMe] = useState<{ x: number; y: number; id: number } | null>(null);
  const [tap, setTap] = useState({ n: 0, x: 0, y: 0 });
  const [hearts, setHearts] = useState({ n: 0, x: 0, y: 0 });
  const [spark, setSpark] = useState({ n: 0, x: 0, y: 0 });
  const [meAct, setMeAct] = useState<'wave' | 'jump' | null>(null);
  const [herAct, setHerAct] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [scene, setScene] = useState<{ n: number; kind: 'hug' | 'mog' } | null>(null);
  const t = useRef(new Animated.Value(0)).current;
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const later = (key: string, ms: number, fn: () => void) => {
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(fn, ms);
  };
  const say = (text: string) => {
    setToast(text);
    later('toast', 2200, () => setToast(null));
  };

  const id = LOCATIONS[loc].id;
  const step = (d: number) => setLoc((i) => (i + d + LOCATIONS.length) % LOCATIONS.length);
  const cast = (kind: 'hug' | 'mog') => {
    if (scene) return;
    t.setValue(0);
    setScene((s) => ({ n: (s?.n ?? 0) + 1, kind }));
  };

  return (
    <NightContext.Provider value={time === 'night'}>
      <View style={[styles.root, { backgroundColor: LOCATION_BG[id][time] }]}>
        {/* сцена — свой слой (как на главной): глубина чибиков не поднимает их над кнопками */}
        <View style={[StyleSheet.absoluteFill, styles.stage]}>
        <Animated.View style={[StyleSheet.absoluteFill, scene ? { transform: worldTransform(t, scene.kind, false) } : null]}>
          <Location id={id} width={width} height={height} time={time} active />
        </Animated.View>

        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={(e) => {
            if (scene) return;
            const { pageX, pageY } = e.nativeEvent;
            setTap((v) => ({ n: v.n + 1, x: pageX, y: pageY }));
            setMeAct(null);
            setGoMe({ x: pageX - size / 2, y: pageY - chibiH, id: Date.now() });
          }}
        />
        <Ripple trigger={tap.n} x={tap.x} y={tap.y} scale={tf.s} />

        {scene ? (
          <AbilityScene
            key={scene.n}
            scene={{ key: `p${scene.n}`, ability: scene.kind === 'mog' ? 'ability.mog' : 'ability.hug', from: 'me', at: Date.now(), blocked: false }}
            t={t}
            reduce={false}
            caster={{ look: MINE[mine].look, emotion: 'joy', value: 60 }}
            target={{ look: HERS[hers].look, emotion: 'joy', value: 50 }}
            width={width}
            height={height}
            size={size}
            ground={tf.y(534)}
            onDone={() => setScene(null)}
          />
        ) : (
          <>
            <Walker
              look={HERS[hers].look}
              emotion={herAct ? 'love' : 'joy'}
              value={herAct ? 75 : 50}
              size={size}
              top={tf.y(520)}
              minTop={minTop}
              maxTop={maxTop}
              minX={minX}
              maxX={maxX}
              startX={minX + (maxX - minX) * 0.85}
              speed={34 * tf.s}
              paused={herAct}
              pose={herAct ? 'wave' : 'idle'}
              label="Чибик партнёра"
              onPress={() => {
                setHerAct(true);
                setHearts((v) => ({ n: v.n + 1, x: width / 2, y: tf.y(500) }));
                say('Думаю о тебе');
                later('her', 2600, () => setHerAct(false));
              }}
            />
            <Walker
              look={MINE[mine].look}
              emotion="joy"
              value={meAct ? 80 : 55}
              size={size}
              top={tf.y(548)}
              minTop={minTop}
              maxTop={maxTop}
              minX={minX}
              maxX={maxX}
              startX={minX + (maxX - minX) * 0.15}
              speed={30 * tf.s}
              paused={meAct !== null}
              pose={meAct ?? 'idle'}
              goTo={goMe}
              label="Мой чибик"
              onPress={() => {
                setMeAct(Math.random() < 0.5 ? 'jump' : 'wave');
                later('me', 2400, () => setMeAct(null));
              }}
            />
          </>
        )}
        <HeartsBurst trigger={hearts.n} x={hearts.x} y={hearts.y} scale={tf.s} />
        </View>
        <SparkPop trigger={spark.n} x={spark.x} y={spark.y} scale={tf.s} />

        {/* место, время суток, образы */}
        <View style={styles.top} pointerEvents="box-none">
          <View style={styles.place}>
            <IconButton icon="chevronLeft" label="Предыдущее место" size={38} onPress={() => step(-1)} />
            <View style={styles.placeName}>
              <Txt weight="displaySemi" size={14} center numberOfLines={1}>
                {LOCATIONS[loc].name}
              </Txt>
              <Txt faint size={11} center>
                {loc + 1} из {LOCATIONS.length}
              </Txt>
            </View>
            <IconButton icon="chevronRight" label="Следующее место" size={38} onPress={() => step(1)} />
          </View>
          <View style={styles.times}>
            {TIMES.map((o) => (
              <Pressy key={o.id} onPress={() => setTime(o.id)} innerStyle={[styles.time, time === o.id ? styles.timeOn : null]}>
                <Txt weight="heavy" size={13} color={time === o.id ? C.text : C.muted}>
                  {o.label}
                </Txt>
              </Pressy>
            ))}
          </View>
          <View style={styles.looks} pointerEvents="box-none">
            <Pressy
              onPress={() => {
                setMine((i) => (i + 1) % MINE.length);
                setSpark((v) => ({ n: v.n + 1, x: width * 0.3, y: 150 }));
              }}
            >
              <Pill>
                <Icon name="hanger" size={15} color={C.me} />
                <Txt weight="heavy" size={13}>
                  Я: {MINE[mine].name}
                </Txt>
              </Pill>
            </Pressy>
            <Pressy onPress={() => setHers((i) => (i + 1) % HERS.length)}>
              <Pill>
                <Icon name="hanger" size={15} color={C.partner} />
                <Txt weight="heavy" size={13}>
                  Она: {HERS[hers].name}
                </Txt>
              </Pill>
            </Pressy>
          </View>
        </View>

        {/* способности */}
        <View style={styles.right} pointerEvents="box-none">
          <Pressy onPress={() => cast('mog')} innerStyle={[styles.ability, { borderColor: '#B79CFFAA' }]} accessibilityLabel="Мог">
            <Icon name="flame" size={26} color="#B79CFF" fill="#B79CFF55" strokeWidth={2.1} />
          </Pressy>
          <Pressy onPress={() => cast('hug')} innerStyle={[styles.ability, { borderColor: '#FF6B8AAA' }]} accessibilityLabel="Объятия">
            <Icon name="heart" size={26} color={C.accent} fill="#FF6B8A55" strokeWidth={2.1} />
          </Pressy>
        </View>

        <Toast text={toast} top={176} />
        <TabBar {...({ state: { routes: ROUTES, index: 0 }, navigation: NAV } as any)} />
      </View>
    </NightContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  stage: { zIndex: 0 },
  top: { position: 'absolute', left: 12, right: 12, top: 12, gap: 8, alignItems: 'center', zIndex: 5000 },
  place: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(22,18,38,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    width: '100%',
    maxWidth: 360,
  },
  placeName: { flex: 1 },
  times: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(22,18,38,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  time: { height: 34, paddingHorizontal: 16, borderRadius: 17, justifyContent: 'center' },
  timeOn: { backgroundColor: 'rgba(255,107,138,0.28)', borderWidth: 1, borderColor: 'rgba(255,143,168,0.5)' },
  looks: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  right: { position: 'absolute', right: 14, bottom: 84, gap: 10, zIndex: 5000 },
  ability: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28,23,48,0.8)',
    borderWidth: 1.5,
    boxShadow: '0px 10px 24px rgba(8,4,20,0.4), inset 0px 1px 0px rgba(255,255,255,0.18)',
  },
});

createRoot(document.getElementById('root')!).render(<Page />);

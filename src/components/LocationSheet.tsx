// Панель выбора локации: сверху живое окно в выбранное место (можно заглянуть днём, вечером и ночью),
// под ним лента карточек всех мест, внизу «Перейти сюда». Касание карточки только показывает место — переход по кнопке.
// Локация одна на пару: сменил один — второй сразу видит то же место (на главной оно проявляется с титром).
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { usePair } from '../context/PairProvider';
import { setLocation } from '../lib/api';
import { LOCATION_BG, LOCATION_LINE, LOCATIONS, locationName, type LocationId } from '../lib/locations';
import { haptic, nativeDriver, useReducedMotion } from '../lib/motion';
import type { DayTime } from '../lib/scene';
import { C, R, S } from '../theme';
import { Icon } from './Icon';
import { Location } from './scene/Location';
import { Sheet } from './Sheet';
import { Button, Pressy, Segmented, Txt } from './ui';

const TIME_LABEL: Record<DayTime, string> = { day: 'днём', evening: 'вечером', night: 'ночью' };
const TIMES: { value: DayTime; label: string }[] = [
  { value: 'day', label: 'День' },
  { value: 'evening', label: 'Вечер' },
  { value: 'night', label: 'Ночь' },
];

const THUMB_W = 104;
const THUMB_H = 70;
const THUMB_GAP = 10;
const PIC_W = THUMB_W - 8; // минус рамка и зазор вокруг картинки

export function LocationSheet({ visible, onClose, current, time, onError, onChoose, title, note }: {
  visible: boolean;
  onClose: () => void;
  current: LocationId;
  time: DayTime;
  onError: (text: string) => void;
  onChoose?: (id: LocationId) => Promise<void>; // своё место (комната); по умолчанию — место пары
  title?: string;
  note?: string;
}) {
  const { patchPair, partner } = usePair();
  const { width } = useWindowDimensions();
  const reduce = useReducedMotion();
  const [pick, setPick] = useState<LocationId>(current);
  const [look, setLook] = useState<DayTime>(time);
  const [busy, setBusy] = useState(false);
  const strip = useRef<ScrollView>(null);
  const heroW = Math.min(width, 560) - S.lg * 2 - 2; // 2 — рамка панели
  const heroH = Math.round(heroW * 0.6);

  // Открыли заново — снова текущее место в настоящем времени суток, лента прокручена к нему
  useEffect(() => {
    if (!visible) return;
    setPick(current);
    setLook(time);
    const t = setTimeout(() => center(current, false), 30);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // выбранная карточка — в середину ленты
  const center = (id: LocationId, animated: boolean) => {
    const i = LOCATIONS.findIndex((l) => l.id === id);
    strip.current?.scrollTo({ x: Math.max(0, i * (THUMB_W + THUMB_GAP) - heroW / 2 + THUMB_W / 2), animated });
  };

  const here = pick === current;
  const go = async () => {
    if (here) return onClose();
    setBusy(true);
    try {
      if (onChoose) {
        await onChoose(pick);
      } else {
        await setLocation(pick);
        patchPair({ location: pick });
      }
      haptic.success();
      onClose();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Не получилось');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={title ?? 'Где вы сегодня?'}>
      <Txt muted size={14}>
        {note ?? `Место одно на двоих${partner ? ` — ${partner.display_name} увидит его сразу` : ''}.`} Сейчас {TIME_LABEL[time]}.
      </Txt>

      <Hero id={pick} time={look} width={heroW} height={heroH} active={visible} here={here} reduce={reduce} />

      <Segmented options={TIMES} value={look} onChange={setLook} />

      <ScrollView
        ref={strip}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.strip}
        contentContainerStyle={styles.stripIn}
        accessibilityRole="radiogroup"
      >
        {LOCATIONS.map((loc, i) => (
          <Thumb
            key={loc.id}
            id={loc.id}
            index={i}
            time={time}
            on={loc.id === pick}
            current={loc.id === current}
            visible={visible}
            reduce={reduce}
            onPress={() => {
              setPick(loc.id);
              center(loc.id, true);
            }}
          />
        ))}
      </ScrollView>

      <Button
        title={here ? 'Вы здесь' : 'Перейти сюда'}
        icon={here ? 'check' : 'pin'}
        variant={here ? 'secondary' : 'primary'}
        loading={busy}
        onPress={go}
      />
    </Sheet>
  );
}

// Окно в место: живая сцена; при смене места или времени новая картинка проявляется поверх старой с лёгким приближением
function Hero({ id, time, width, height, active, here, reduce }: { id: LocationId; time: DayTime; width: number; height: number; active: boolean; here: boolean; reduce: boolean }) {
  const key = `${id}.${time}`;
  const [layers, setLayers] = useState([{ key, id, time }]);
  const fade = useRef(new Animated.Value(1)).current;
  const text = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (layers[layers.length - 1].key === key) return;
    setLayers((l) => [l[l.length - 1], { key, id, time }]);
    fade.setValue(0);
    text.setValue(0);
    const anim = Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: reduce ? 160 : 420, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }),
      Animated.timing(text, { toValue: 1, duration: reduce ? 160 : 460, delay: reduce ? 0 : 90, easing: Easing.out(Easing.back(1.4)), useNativeDriver: nativeDriver }),
    ]);
    anim.start(({ finished }) => {
      if (finished) setLayers((l) => l.slice(-1));
    });
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // картинка целиком по высоте сцены, показываем полосу от горизонта до земли, где гуляют чибики
  const sceneH = Math.round((width * 844) / 390);
  const top = -Math.round(sceneH * 0.37);
  const top2 = layers.length > 1;
  return (
    <View style={[styles.hero, { width, height, backgroundColor: LOCATION_BG[id][time] }]}>
      {layers.map((l, i) => {
        const fresh = top2 && i === 1;
        return (
          <Animated.View
            key={l.key}
            style={[
              StyleSheet.absoluteFill,
              fresh
                ? { opacity: fade, transform: [{ scale: reduce ? 1 : fade.interpolate({ inputRange: [0, 1], outputRange: [1.07, 1] }) }] }
                : null,
            ]}
          >
            {active ? (
              <View style={{ position: 'absolute', left: 0, top, width, height: sceneH }}>
                <Location id={l.id} width={width} height={sceneH} time={l.time} active={active && i === layers.length - 1} />
              </View>
            ) : null}
          </Animated.View>
        );
      })}
      <View pointerEvents="none" style={styles.shade}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="locHeroShade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#0B0A14" stopOpacity={0} />
              <Stop offset="0.55" stopColor="#0B0A14" stopOpacity={0.45} />
              <Stop offset="1" stopColor="#0B0A14" stopOpacity={0.88} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={100} height={100} fill="url(#locHeroShade)" />
        </Svg>
      </View>
      <Animated.View
        pointerEvents="none"
        style={[styles.caption, { opacity: text, transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}
      >
        <Txt weight="display" size={20} numberOfLines={1} style={styles.glow}>
          {locationName(id)}
        </Txt>
        <Txt size={13} color="rgba(246,243,255,0.82)" numberOfLines={1}>
          {LOCATION_LINE[id]}
        </Txt>
      </Animated.View>
      {here ? (
        <View pointerEvents="none" style={styles.badge}>
          <Icon name="pin" size={13} color={C.onAccent} strokeWidth={2.4} />
          <Txt weight="heavy" size={12} color={C.onAccent}>
            Вы здесь
          </Txt>
        </View>
      ) : null}
      <View pointerEvents="none" style={styles.rim} />
    </View>
  );
}

// Карточка в ленте: появляется по очереди при открытии, выбранная — с подсветкой и чуть крупнее
function Thumb({ id, index, time, on, current, visible, reduce, onPress }: {
  id: LocationId;
  index: number;
  time: DayTime;
  on: boolean;
  current: boolean;
  visible: boolean;
  reduce: boolean;
  onPress: () => void;
}) {
  const enter = useRef(new Animated.Value(0)).current;
  const sel = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    if (!visible) return enter.setValue(0);
    if (reduce) return enter.setValue(1);
    const a = Animated.timing(enter, { toValue: 1, duration: 380, delay: 120 + Math.min(index, 6) * 45, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver });
    a.start();
    return () => a.stop();
  }, [visible, reduce, index, enter]);
  useEffect(() => {
    Animated.spring(sel, { toValue: on ? 1 : 0, useNativeDriver: nativeDriver, speed: 18, bounciness: 9 }).start();
  }, [on, sel]);

  const sceneH = Math.round((PIC_W * 844) / 390);
  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
          { scale: sel.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
        ],
      }}
    >
      <Pressy
        onPress={onPress}
        scaleTo={0.92}
        style={{ width: THUMB_W }}
        innerStyle={{ width: THUMB_W }}
        accessibilityRole="radio"
        accessibilityState={{ checked: on }}
        accessibilityLabel={`${locationName(id)}${current ? ', вы здесь' : ''}`}
      >
        <View style={[styles.thumb, on ? styles.thumbOn : null]}>
          <View style={[styles.thumbPic, { backgroundColor: LOCATION_BG[id][time] }]}>
            {visible ? (
              <View style={{ position: 'absolute', left: 0, top: -Math.round(sceneH * 0.38), width: PIC_W, height: sceneH }}>
                <Location id={id} width={PIC_W} height={sceneH} time={time} active={false} />
              </View>
            ) : null}
            {current ? (
              <View style={styles.here}>
                <Icon name="pin" size={11} color={C.onAccent} strokeWidth={2.6} />
              </View>
            ) : null}
          </View>
        </View>
        <Txt weight="heavy" size={12} numberOfLines={2} color={on ? C.text : C.muted} style={styles.thumbName}>
          {locationName(id)}
        </Txt>
      </Pressy>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignSelf: 'center',
    borderRadius: R.lg,
    overflow: 'hidden',
    boxShadow: '0px 10px 28px rgba(4,2,14,0.5)',
  },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '58%' },
  caption: { position: 'absolute', left: 14, right: 14, bottom: 12, gap: 2 },
  glow: { textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 1 } },
  badge: {
    position: 'absolute',
    left: 10,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: C.accent,
    boxShadow: '0px 0px 14px rgba(255,107,138,0.6)',
  },
  // свет по верхней кромке окна (как у стекла 3.0)
  rim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderTopColor: 'rgba(255,255,255,0.32)',
  },
  strip: { marginHorizontal: -S.lg, marginTop: -6, flexGrow: 0 },
  stripIn: { gap: THUMB_GAP, paddingHorizontal: S.lg, paddingTop: 10, paddingBottom: 2 },
  thumb: {
    borderRadius: R.md,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 2,
  },
  thumbOn: { borderColor: C.accent, boxShadow: '0px 0px 16px rgba(255,107,138,0.55)' },
  thumbPic: { height: THUMB_H, borderRadius: R.md - 4, overflow: 'hidden' },
  thumbName: { marginTop: 6, paddingHorizontal: 2, lineHeight: 15 },
  here: {
    position: 'absolute',
    right: 5,
    top: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

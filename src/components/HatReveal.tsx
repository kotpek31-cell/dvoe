// «Шляпа грибника» получена (0.2.2): затемнение, вихрь спор, шляпа опускается на голову, карточка и звук.
// Поверх любого экрана (в _layout). «Надеть» — сразу в образ; dry — проверка из комнаты разработчиков.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg from 'react-native-svg';
import { usePair } from '../context/PairProvider';
import { updateMyProfile } from '../lib/api';
import { renderLayer } from '../lib/art';
import { headX, headY, HS } from '../lib/body';
import { useCatalog } from '../lib/catalog';
import { lookOf, lookToChibi, wear } from '../lib/chibi';
import { errorMessage } from '../lib/env';
import { haptic, nativeDriver, useReducedMotion } from '../lib/motion';
import { closeHatReveal, HAT_ID, useHatReveal } from '../lib/mushrooms';
import { playSound } from '../lib/sound';
import { C } from '../theme';
import { Chibi } from './Chibi';
import { Button, Txt } from './ui';

const LAND_MS = 1300;
const SPORE_COLORS = ['#C9FFB0', '#FFF4C2', '#D9C4FF'];

export function HatReveal() {
  const reveal = useHatReveal();
  if (!reveal) return null;
  return <RevealView key={reveal.n} dry={reveal.dry} />;
}

function RevealView({ dry }: { dry: boolean }) {
  const { me, refresh } = usePair();
  const catalog = useCatalog();
  const reduce = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const t = useRef(new Animated.Value(0)).current; // 0…2600 мс
  const spin = useRef(new Animated.Value(0)).current;
  const [landed, setLanded] = useState(reduce);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hat = catalog.get(HAT_ID);
  const look = useMemo(() => lookOf(me), [me]);
  const bare = useMemo(() => ({ ...look, hat: null }), [look]);
  const withHat = useMemo(() => (hat ? wear(look, 'hat', hat) : look), [look, hat]);
  const wearing = look.hat?.id === HAT_ID;

  const size = Math.min(170, width * 0.42);
  const k = size / 120;
  const chibiH = (size * 170) / 120;
  const cx = width / 2;
  const top = height * 0.2;

  useEffect(() => {
    playSound('magic', 0.9);
    haptic.medium();
    const anim = Animated.timing(t, { toValue: 2600, duration: reduce ? 1 : 2600, easing: Easing.linear, useNativeDriver: nativeDriver });
    anim.start();
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: nativeDriver }));
    if (!reduce) loop.start();
    const land = setTimeout(
      () => {
        setLanded(true);
        playSound('win', 0.8);
        haptic.success();
      },
      reduce ? 0 : LAND_MS,
    );
    return () => {
      anim.stop();
      loop.stop();
      clearTimeout(land);
    };
  }, [t, spin, reduce]);

  const hatArt = useMemo(() => {
    const layers = hat?.art.layers;
    if (!layers) return null;
    const paint = { c: '#888888', skin: '#FFDCC4', ids: 'reveal' };
    return [...renderLayer(layers.hat, { ...paint, ids: 'revealhat' }, 'rv.hat', 'head'), ...renderLayer(layers.over, { ...paint, ids: 'revealover' }, 'rv.over', 'head')];
  }, [hat]);

  const spores = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const a = (i / 22) * Math.PI * 2;
        const r = (0.55 + (i % 4) * 0.16) * size;
        return { key: i, x: Math.cos(a) * r, y: Math.sin(a) * r * 0.8, d: 4 + (i % 3) * 2, c: SPORE_COLORS[i % 3] };
      }),
    [size],
  );

  const putOn = async () => {
    if (!me || !hat) return;
    setBusy(true);
    setError(null);
    try {
      await updateMyProfile(me.id, { chibi: lookToChibi(withHat) });
      await refresh();
      haptic.success();
      closeHatReveal();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const fade = t.interpolate({ inputRange: [0, 300], outputRange: [0, 1], extrapolate: 'clamp' });
  const vortex = t.interpolate({ inputRange: [0, 900, 1500, 2600], outputRange: [1.5, 1, 0.75, 1.15], extrapolate: 'clamp' });
  const hatY = t.interpolate({ inputRange: [0, 300, LAND_MS], outputRange: [-height * 0.3, -height * 0.3, 0], extrapolate: 'clamp' });
  const flash = t.interpolate({ inputRange: [LAND_MS - 40, LAND_MS + 40, LAND_MS + 500], outputRange: [0, 0.75, 0], extrapolate: 'clamp' });
  const card = t.interpolate({ inputRange: [LAND_MS + 200, LAND_MS + 700], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]} accessibilityViewIsModal>
      <View style={[StyleSheet.absoluteFill, styles.dim]} />
      {/* свечение и вихрь спор вокруг чибика */}
      <View pointerEvents="none" style={[styles.glow, { left: cx - size * 1.4, top: top + chibiH * 0.5 - size * 1.4, width: size * 2.8, height: size * 2.8, borderRadius: size * 1.4 }]} />
      <Animated.View
        pointerEvents="none"
        style={{ position: 'absolute', left: cx, top: top + chibiH * 0.45, transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }, { scale: vortex }] }}
      >
        {spores.map((s) => (
          <View key={s.key} style={{ position: 'absolute', left: s.x - s.d / 2, top: s.y - s.d / 2, width: s.d, height: s.d, borderRadius: s.d / 2, backgroundColor: s.c, opacity: 0.85 }} />
        ))}
      </Animated.View>

      <View pointerEvents="none" style={{ position: 'absolute', left: cx - size / 2, top, width: size, height: chibiH }}>
        <Chibi look={landed ? withHat : bare} emotion={landed ? 'joy' : 'inspiration'} value={landed ? 95 : 70} pose={landed ? 'cheer' : 'idle'} size={size} />
        {!landed && hatArt ? (
          <Animated.View style={{ position: 'absolute', left: headX(-30) * k, top: headY(-40) * k, transform: [{ translateY: hatY }] }}>
            {/* шляпа — в координатах головы: она меньше тела (см. body.ts) */}
            <Svg width={200 * k * HS} height={224 * k * HS} viewBox="-30 -40 200 224">
              {hatArt}
            </Svg>
          </Animated.View>
        ) : null}
      </View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, { opacity: flash }]} />

      <Animated.View style={[styles.cardWrap, { top: top + chibiH + 24, opacity: card, transform: [{ translateY: card.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>
        <View style={styles.card} accessibilityRole="alert">
          <View style={styles.cardHead}>
            <Svg width={72} height={54} viewBox="0 -26 120 86">
              {hatArt}
            </Svg>
            <View style={styles.flex}>
              <Txt weight="display" size={17}>
                Шляпа грибника
              </Txt>
              <Txt weight="heavy" size={13} color={C.good}>
                Секретная вещь{dry ? ' · проверка' : ''}
              </Txt>
            </View>
          </View>
          <Txt muted size={14} center>
            Надень — и «Мог» отскочит обратно
          </Txt>
          {error ? (
            <Txt size={13} color={C.bad} center>
              {error}
            </Txt>
          ) : null}
          {dry || wearing ? (
            <Button title="Закрыть" onPress={closeHatReveal} />
          ) : (
            <View style={styles.row}>
              <Button title="Позже" variant="secondary" onPress={closeHatReveal} style={styles.flex} />
              <Button title="Надеть" icon="check" onPress={putOn} loading={busy} disabled={!hat} style={styles.flex} />
            </View>
          )}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 100, elevation: 100 },
  dim: { backgroundColor: 'rgba(7,4,15,0.78)' },
  glow: { position: 'absolute', backgroundColor: 'rgba(201,255,176,0.12)' },
  flash: { backgroundColor: '#F4FFE8' },
  cardWrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: 18,
    gap: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(28,23,48,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(94,211,160,0.45)',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});

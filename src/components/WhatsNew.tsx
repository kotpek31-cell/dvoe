// «Что нового» в 0.2: 5 ярких карточек, листаются вбок; на каждой картинка и 1–2 строки, внизу «Понятно».
// Тексты хранятся в приложении. Картинки собраны из чибиков, иконок и маленькой локации — без файлов.
import { useRef, useState, type ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { usePair } from '../context/PairProvider';
import { LOOKS, lookOf, type Look } from '../lib/chibi';
import { closeWhatsNew, useWhatsNew } from '../lib/whatsNew';
import { C, R, S } from '../theme';
import { Chibi } from './Chibi';
import { Icon, type IconName } from './Icon';
import { Location } from './scene/Location';
import { Button, Txt } from './ui';

type Card = { title: string; text: string; tint: string; art: (w: number, h: number, me: Look) => ReactNode };

const pair = (me: Look, other: Look, size: number, pose: 'idle' | 'hug' | 'cheer', emotion: 'joy' | 'love', gap = 0.5) => (
  <View style={[styles.row, { gap: -size * (1 - gap) + size * 0.1 }]}>
    <Chibi look={me} emotion={emotion} value={70} pose={pose} size={size} still />
    <Chibi look={other} emotion={emotion} value={70} pose={pose} size={size} flip still />
  </View>
);

const badge = (icon: IconName, color: string, size = 64) => (
  <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2, borderColor: `${color}88`, backgroundColor: `${color}26` }]}>
    <Icon name={icon} size={size * 0.48} color={color} fill={`${color}55`} />
  </View>
);

const CARDS: Card[] = [
  {
    title: 'Гардероб',
    text: 'Переодевай чибика: причёски, глаза, одежда, вещи в руках и 10 цветов. Партнёр видит образ сразу.',
    tint: C.partner,
    art: (w, h, me) => (
      <View style={styles.center}>
        <Chibi look={{ ...me, hat: { id: 'hat.panama' }, hand: { id: 'hand.balloon' } }} emotion="joy" value={80} pose="idle" size={h * 0.62} still />
      </View>
    ),
  },
  {
    title: 'Способности',
    text: 'Круглая кнопка справа внизу на главной. «Объятия» есть у всех; подержи кнопку, чтобы сменить способность.',
    tint: C.accent,
    art: (w, h, me) => <View style={styles.center}>{pair(me, LOOKS.girl, h * 0.5, 'hug', 'love', 0.55)}</View>,
  },
  {
    title: 'Секретные коды',
    text: 'Профиль → «Коды». Никто не знает, что будет…',
    tint: C.warn,
    art: () => (
      <View style={styles.center}>
        <View style={[styles.row, { gap: 14, alignItems: 'center' }]}>
          {badge('key', C.warn, 84)}
          {badge('sparkle', '#C59BFF', 56)}
        </View>
      </View>
    ),
  },
  {
    title: 'Новые места',
    text: 'Нажми на название места сверху на главной: луг, северное сияние, крыша города или пляж. Место одно на двоих.',
    tint: '#7FD8FF',
    art: (w, h) => {
      const sceneH = Math.round((w * 844) / 390);
      return (
        <View style={[styles.scene, { width: w, height: h }]}>
          <View style={{ position: 'absolute', top: -sceneH * 0.36, left: 0 }}>
            <Location id="aurora" width={w} height={sceneH} time="night" active={false} />
          </View>
        </View>
      );
    },
  },
  {
    title: 'Чибики живее',
    text: 'Нажми на землю — чибик пойдёт туда. Когда вы оба в приложении, у имени горит зелёная точка, а чибики иногда дают пять.',
    tint: C.good,
    art: (w, h, me) => <View style={styles.center}>{pair(me, LOOKS.girl, h * 0.5, 'cheer', 'joy', 0.7)}</View>,
  },
];

export function WhatsNew() {
  const { open } = useWhatsNew();
  const { me } = usePair();
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const cardW = Math.min(width - S.lg * 2, 380);
  const artH = Math.round(Math.min(height * 0.36, cardW * 0.8));
  const myLook = me ? lookOf(me) : LOOKS.nb;
  const last = page === CARDS.length - 1;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / cardW);
    if (p !== page) setPage(Math.max(0, Math.min(CARDS.length - 1, p)));
  };

  const close = () => {
    closeWhatsNew();
    setPage(0);
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.card, { width: cardW }]}>
          <Txt weight="display" size={13} color={C.muted} style={styles.kicker}>
            ЧТО НОВОГО В 0.2
          </Txt>
          <ScrollView
            ref={scroll}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={32}
            style={{ width: cardW }}
          >
            {CARDS.map((c) => (
              <View key={c.title} style={{ width: cardW }}>
                <View style={[styles.art, { height: artH, backgroundColor: `${c.tint}1F` }]}>{c.art(cardW - S.lg * 2, artH, myLook)}</View>
                <View style={styles.texts}>
                  <Txt weight="display" size={22}>
                    {c.title}
                  </Txt>
                  <Txt size={15} color={C.muted}>
                    {c.text}
                  </Txt>
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={styles.dots}>
            {CARDS.map((c, i) => (
              <View key={c.title} style={[styles.dot, i === page ? styles.dotOn : null]} />
            ))}
          </View>
          <View style={styles.actions}>
            <Button
              title={last ? 'Понятно' : 'Дальше'}
              onPress={() => {
                if (last) return close();
                scroll.current?.scrollTo({ x: (page + 1) * cardW, animated: true });
                setPage(page + 1);
              }}
            />
            {!last ? <Button title="Понятно" variant="ghost" onPress={close} /> : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,4,12,0.78)', alignItems: 'center', justifyContent: 'center', padding: S.lg },
  card: {
    backgroundColor: '#1A1530',
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: C.glassBorder,
    overflow: 'hidden',
    paddingBottom: S.lg,
  },
  kicker: { paddingHorizontal: S.lg, paddingTop: S.lg, paddingBottom: S.sm, letterSpacing: 1.5 },
  art: { marginHorizontal: S.lg, borderRadius: R.lg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  scene: { overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  badge: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  texts: { paddingHorizontal: S.lg, paddingTop: S.md, gap: 6, minHeight: 120 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: S.md },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.22)' },
  dotOn: { width: 20, backgroundColor: C.accent },
  actions: { paddingHorizontal: S.lg, gap: S.xs },
});

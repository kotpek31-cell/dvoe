// «Что нового» в 0.2.1: 4 яркие карточки, листаются вбок; на каждой картинка и 1–2 строки, внизу «Понятно».
// Тексты хранятся в приложении. Картинки собраны из чибиков, иконок и маленькой локации — без файлов.
import { useRef, useState, type ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { usePair } from '../context/PairProvider';
import { LOOKS, lookOf, type Look } from '../lib/chibi';
import { closeWhatsNew, useWhatsNew } from '../lib/whatsNew';
import { C, R, S } from '../theme';
import { Chibi } from './Chibi';
import { Location } from './scene/Location';
import { Button, Txt } from './ui';

type Card = { title: string; text: string; tint: string; art: (w: number, h: number, me: Look) => ReactNode };

const scene = (id: 'forest' | 'sakura', time: 'night' | 'day') => (w: number, h: number) => {
  const sceneH = Math.round((w * 844) / 390);
  return (
    <View style={[styles.scene, { width: w, height: h }]}>
      <View style={{ position: 'absolute', top: -sceneH * 0.4, left: 0 }}>
        <Location id={id} width={w} height={sceneH} time={time} active={false} />
      </View>
    </View>
  );
};

const PUMPKIN: Look = { ...LOOKS.nb, hair: { id: 'hair.fluffy', c: 'ginger' }, eyes: { id: 'eyes.happy' }, hat: { id: 'hat.pumpkin' }, top: { id: 'top.pumpkin' }, bottom: { id: 'bottom.pants', c: 'coal' }, hand: { id: 'hand.jack' } };

const CARDS: Card[] = [
  {
    title: 'Хэллоуин',
    text: 'Костюмы тыквы, вампира, ведьмы и Франкенштейна — за секретные коды (Профиль → «Коды»). Некоторые достанутся только одному человеку во всём приложении.',
    tint: '#FF9A3D',
    art: (w, h) => (
      <View style={styles.center}>
        <Chibi look={PUMPKIN} emotion="joy" value={80} pose="idle" size={h * 0.62} still />
      </View>
    ),
  },
  {
    title: 'Гардероб вырос',
    text: 'Больше 50 новых вещей: причёски, глаза, обувь, плащи, зонтик, гитара. Новая категория «Лицо» — очки, веснушки, маска для сна.',
    tint: C.partner,
    art: (w, h, me) => (
      <View style={styles.center}>
        <Chibi look={{ ...me, face: { id: 'face.glasses' }, back: { id: 'back.scarf' }, hand: { id: 'hand.icecream' } }} emotion="joy" value={80} pose="idle" size={h * 0.62} still />
      </View>
    ),
  },
  {
    title: '12 мест',
    text: 'Лес с костром, снежная деревня, кафе, Луна, сад сакуры, город под дождём, горы и пещера с кристаллами. Нажми на название места сверху на главной.',
    tint: '#7FD8FF',
    art: scene('forest', 'night'),
  },
  {
    title: 'Звуки мест',
    text: 'У каждого места свой тихий фон: треск костра, дождь, волны. Выключить можно в настройках — «Звуки места».',
    tint: C.good,
    art: scene('sakura', 'day'),
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
            ЧТО НОВОГО В 0.2.1
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
  texts: { paddingHorizontal: S.lg, paddingTop: S.md, gap: 6, minHeight: 120 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: S.md },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.22)' },
  dotOn: { width: 20, backgroundColor: C.accent },
  actions: { paddingHorizontal: S.lg, gap: S.xs },
});

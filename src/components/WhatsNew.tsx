// «Что нового» 3.0: новые чибики, живые места, эффекты; за ними — этап фиксации 0.2 (джойстик, объятия, шапки, звук, на iPhone — иконка), 0.2.2 и 0.2.1.
// Про комнату — ни слова (она секретная). Яркие карточки, листаются вбок; на каждой картинка и 1–2 строки, внизу «Понятно».
// Тексты хранятся в приложении. Картинки собраны из чибиков, иконок и маленькой локации — без файлов.
import { useRef, useState, type ReactNode } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { usePair } from '../context/PairProvider';
import { LOOKS, lookOf, type Look } from '../lib/chibi';
import { closeWhatsNew, useWhatsNew } from '../lib/whatsNew';
import { C, R, S } from '../theme';
import { Chibi } from './Chibi';
import { Location } from './scene/Location';
import { MushroomArt } from './scene/Mushrooms';
import { Icon } from './Icon';
import { Button, Txt } from './ui';

type Card = { title: string; text: string; tint: string; art: (w: number, h: number, me: Look) => ReactNode };

const scene = (id: 'forest' | 'sakura' | 'meadow', time: 'night' | 'day') => (w: number, h: number) => {
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

// грибы вразброс, не в ряд — порядок не подсказываем
const SHROOMS = [
  { c: 'blue', x: 0.18, y: 0.7, s: 0.2 },
  { c: 'white', x: 0.47, y: 0.8, s: 0.26 },
  { c: 'red', x: 0.74, y: 0.66, s: 0.17 },
] as const;

// iPhone: иконку экрана «Домой» (и в уведомлениях) система запоминает, когда сайт добавляют, — её меняет только повторное добавление
const iosWeb = Platform.OS === 'web' && typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);

// Джойстик: стекло и кнопка-кругляш (как в приложении)
const stick = (size: number) => (
  <View style={[styles.stick, { width: size, height: size, borderRadius: size / 2 }]}>
    <View style={[styles.knob, { width: size * 0.44, height: size * 0.44, borderRadius: size * 0.22, transform: [{ translateX: size * 0.16 }, { translateY: -size * 0.08 }] }]} />
  </View>
);

const REDESIGN: Card[] = [
  {
    title: 'Новые чибики',
    text: 'Стройнее и живее: мягкий объём и свет, шаг, прыжок и сон по-новому. Вся одежда из гардероба уже сидит по фигуре.',
    tint: C.me,
    art: (w, h, me) => (
      <View style={[styles.center, styles.row, { gap: w * 0.06 }]}>
        <Chibi look={me} emotion="joy" value={80} pose="idle" size={h * 0.62} still />
        <Chibi look={LOOKS.girl} emotion="love" value={75} pose="wave" size={h * 0.62} flip still />
      </View>
    ),
  },
  {
    title: 'Места ожили',
    text: 'Свет и глубина во всех 12 местах. Звёзды мерцают и падают, плывут облака, на лугу — бабочки и светлячки.',
    tint: '#9B8CFF',
    art: scene('meadow', 'night'),
  },
  {
    title: 'Искры и сердца',
    text: 'Сердечки, конфетти и круг от касания земли. У «Объятий» — лучи и свечение, у «Мог» — молнии и вспышка.',
    tint: C.accent,
    art: (w, h) => (
      <View style={[styles.center, styles.row, { gap: w * 0.06, alignItems: 'center' }]}>
        <Icon name="sparkle" size={h * 0.26} color="#FFC266" strokeWidth={1.6} />
        <Icon name="heart" size={h * 0.4} color={C.accent} fill="#FF6B8A55" strokeWidth={1.6} />
        <Icon name="flame" size={h * 0.26} color="#B79CFF" strokeWidth={1.6} />
      </View>
    ),
  },
];

const FIX: Card[] = [
  {
    title: 'Джойстик',
    text: 'Слева внизу на главной: веди пальцем — чибик идёт, дальше от центра — бежит. Выключить — в настройках.',
    tint: C.me,
    art: (w, h, me) => (
      <View style={[styles.center, styles.row, { gap: w * 0.08 }]}>
        <View style={{ marginBottom: h * 0.12 }}>{stick(h * 0.36)}</View>
        <Chibi look={me} emotion="joy" value={80} pose="run" size={h * 0.56} still />
      </View>
    ),
  },
  {
    title: 'Объятия ожили',
    text: 'Чибики подбегают, тянут руки, обнимаются и покачиваются — а потом машут друг другу.',
    tint: C.partner,
    art: (w, h, me) => (
      <View style={[styles.center, styles.row]}>
        <Chibi look={me} emotion="love" value={85} pose="hug" size={h * 0.56} still />
        <View style={{ marginLeft: -h * 0.2 }}>
          <Chibi look={LOOKS.girl} emotion="love" value={85} pose="hug" size={h * 0.56} flip still />
        </View>
      </View>
    ),
  },
  {
    title: 'Шапки с объёмом',
    text: 'У головных уборов появились блики, тени и строчки — сидят на голове, а не лежат наклейкой.',
    tint: '#FFC266',
    art: (w, h, me) => (
      <View style={[styles.center, styles.row, { gap: w * 0.04 }]}>
        <Chibi look={{ ...me, hat: { id: 'hat.beanie' } }} emotion="joy" value={70} pose="idle" size={h * 0.5} still />
        <Chibi look={{ ...LOOKS.girl, hat: { id: 'hat.panama' } }} emotion="joy" value={70} pose="idle" size={h * 0.5} still />
      </View>
    ),
  },
  {
    title: 'Звук',
    text:
      Platform.OS === 'web'
        ? 'Звуки снова слышны на iPhone — и в беззвучном режиме. Если нужно тихо — «Настройки» → «Тихо в беззвучном режиме».'
        : 'Звуки способностей и мест играют на громкости медиа. Выключить — в настройках.',
    tint: C.good,
    art: (w, h) => (
      <View style={styles.center}>
        <Icon name="bell" size={h * 0.4} color={C.good} strokeWidth={1.6} />
      </View>
    ),
  },
  ...(iosWeb
    ? [
        {
          title: 'Новая иконка на iPhone',
          text: 'Чтобы «Ладошки» появились на экране «Домой» и в уведомлениях: удали «Двое» с экрана «Домой», открой сайт в Safari, «Поделиться» → «На экран Домой», войди и включи уведомления в настройках.',
          tint: C.accent,
          art: (w: number, h: number) => (
            <View style={styles.center}>
              <Icon name="phone" size={h * 0.42} color={C.accent} strokeWidth={1.6} />
            </View>
          ),
        },
      ]
    : []),
];

const CARDS: Card[] = [
  ...REDESIGN,
  ...FIX,
  {
    title: 'В лесу что-то выросло',
    text: 'Говорят, грибы любят порядок.',
    tint: '#B07BFF',
    art: (w, h) => (
      <View style={{ width: w, height: h }}>
        {scene('forest', 'night')(w, h)}
        {SHROOMS.map((m) => (
          <View key={m.c} style={{ position: 'absolute', left: m.x * w - (m.s * h) / 2, top: m.y * h - m.s * h }}>
            <MushroomArt color={m.c} size={m.s * h} glow={0.6} />
          </View>
        ))}
      </View>
    ),
  },
  {
    title: 'Ходи во все стороны',
    text: 'Нажми на землю ближе или дальше — чибик пойдёт туда: вдали меньше, рядом крупнее.',
    tint: C.me,
    art: (w, h, me) => (
      <View style={[styles.center, styles.row, { gap: w * 0.08 }]}>
        <View style={{ marginBottom: h * 0.28 }}>
          <Chibi look={me} emotion="calm" value={60} pose="idle" size={h * 0.36} still />
        </View>
        <Chibi look={me} emotion="joy" value={80} pose="idle" size={h * 0.62} still />
      </View>
    ),
  },
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
            ЧТО НОВОГО
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
  stick: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(24,18,40,0.55)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.24)' },
  knob: { backgroundColor: 'rgba(246,243,255,0.9)', borderWidth: 2, borderColor: '#2B2035' },
  actions: { paddingHorizontal: S.lg, gap: S.xs },
});

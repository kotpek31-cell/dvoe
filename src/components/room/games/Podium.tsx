// Пьедестал после игры: места, «Новый рекорд!», награда (карточка вещи), «Ещё раз» и «Закрыть».
// Рекорды и награды пишет сервер — только если играли хотя бы двое людей.
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { RoomMember } from '../../../lib/api';
import type { Catalog } from '../../../lib/catalog';
import { lookOf, wear, type Look, type WearCat } from '../../../lib/chibi';
import type { GameSnap } from '../../../lib/games/host';
import { isDraw, winnersOf } from '../../../lib/games/rules';
import { haptic } from '../../../lib/motion';
import { playSound } from '../../../lib/sound';
import { C } from '../../../theme';
import { Chibi } from '../../Chibi';
import { Confetti } from '../../Effects';
import { LookThumb, type Crop } from '../../ItemTile';
import { Button, Pressy, Txt } from '../../ui';
import { Icon } from '../../Icon';
import { GAME_COLOR, GAME_NAME } from './PreGame';

const REWARD_NOTE: Record<string, string> = { 'hand.trophy': 'Первая победа', 'hat.champion': '10 побед', 'back.champion': '25 побед' };
const REWARD_CROP: Record<string, Crop> = { 'hand.trophy': 'body', 'hat.champion': 'head', 'back.champion': 'wide' };
const PED = [
  { color: '#FFD45E', h: 1 },
  { color: '#D9D4E8', h: 0.72 },
  { color: '#E0A070', h: 0.55 },
];

export function bestText(game: GameSnap['game'], v: number | undefined | null) {
  if (v === undefined || v === null || !Number.isFinite(v)) return '';
  if (game === 'stars') return `${v} ${v % 10 === 1 && v % 100 !== 11 ? 'звезда' : [2, 3, 4].includes(v % 10) && ![12, 13, 14].includes(v % 100) ? 'звезды' : 'звёзд'}`;
  if (game === 'reaction') return `${(v / 1000).toFixed(2).replace('.', ',')} с`;
  return '';
}

type Props = {
  snap: GameSnap;
  meId: string | null;
  userId: string | null;
  members: RoomMember[];
  catalog: Catalog;
  width: number;
  height: number;
  top: number;
  bottom: number;
  busy: boolean;
  onClose: () => void;
  onAgain: () => void;
  onRecords: () => void;
};

export function Podium({ snap, meId, userId, members, catalog, width, height, top, bottom, busy, onClose, onAgain, onRecords }: Props) {
  const res = snap.result;
  useEffect(() => {
    playSound('win', 0.8);
    haptic.success();
  }, []);
  if (!res) return null;
  const member = (m: string) => members.find((x) => x.id === m);
  const name = (m: string) => (m === meId ? 'ты' : (member(m)?.name ?? 'Кто-то'));
  // места с повторами: одинаковый результат — общее место; у старых версий ranks нет — места подряд
  const ranks: Record<string, number> = res.ranks ?? Object.fromEntries(res.places.map((m, i) => [m, i + 1]));
  const draw = isDraw(ranks);
  const winners = winnersOf(ranks, res.places);
  const names = (list: string[]) => list.map(name).join(' и ');
  const title = draw
    ? 'Ничья!'
    : winners.length === 1
      ? winners[0] === meId
        ? 'Победа — твоя!'
        : `Победа — ${name(winners[0])}!`
      : `Победа делится: ${names(winners)}`;
  const st = snap.st;
  const value = (m: string): string => {
    if (st?.g === 'stars') return bestText('stars', st.scores[m] ?? 0);
    if (st?.g === 'reaction') {
      const n = st.points[m] ?? 0;
      return `${n} ${n === 1 ? 'очко' : n >= 2 && n <= 4 ? 'очка' : 'очков'}`;
    }
    return '';
  };
  const myRecord = res.records.find((r) => r.member === meId);
  const otherRecords = res.records.filter((r) => r.member !== meId);
  const myRewards = res.rewards.filter((r) => r.user_id === userId);
  const otherRewards = res.rewards.filter((r) => r.user_id !== userId);
  // ступени: на каждой — все, кто делит это место (1, 1, 3 — две на золотой, одна на бронзовой)
  const tiers: { rank: number; list: string[] }[] = [];
  res.places.forEach((m) => {
    const r = ranks[m] ?? res.places.length;
    if (r > 3) return;
    const t = tiers.find((x) => x.rank === r);
    if (t) t.list.push(m);
    else tiers.push({ rank: r, list: [m] });
  });
  const rest = res.places.filter((m) => (ranks[m] ?? 99) > 3);
  const onStage = tiers.reduce((a, t) => a + t.list.length, 0);
  const pedW = Math.min(110, (width - 48) / Math.max(3, onStage));
  const pedH = Math.min(150, height * 0.17);
  const chibi = Math.round(pedW * 0.86);
  // порядок на пьедестале: 2 — 1 — 3
  const order = tiers.length === 2 ? [1, 0] : [1, 0, 2].filter((i) => i < tiers.length);
  const myLook: Look | null = meId ? lookOf({ chibi: member(meId)?.chibi }) : null;

  const status =
    res.saved === null
      ? 'Сохраняем итог…'
      : res.saved === false
        ? (res.message ?? 'Итог не сохранился')
        : !res.counted
          ? 'Рекорды и награды — когда играют хотя бы двое людей'
          : null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.dim]}>
      <Confetti trigger={1} colors={[GAME_COLOR[snap.game], '#FFD45E', C.partner, C.me, C.good]} width={width} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: top + 64, paddingBottom: bottom + 24, minHeight: height }]}>
        <Txt weight="bold" size={13} muted center>
          {GAME_NAME[snap.game]}
        </Txt>
        <Txt weight="display" size={24} center style={styles.shadow}>
          {title}
        </Txt>
        {myRecord ? (
          <View style={styles.record}>
            <Icon name="star" size={16} color={C.good} fill={C.good} />
            <Txt weight="heavy" size={13.5} color={C.good}>
              Новый рекорд{bestText(snap.game, myRecord.best) ? `: ${bestText(snap.game, myRecord.best)}` : '!'}
            </Txt>
          </View>
        ) : null}
        {otherRecords.length ? (
          <Txt weight="bold" size={13} muted center>
            Новый рекорд: {otherRecords.map((r) => `${name(r.member)} — ${bestText(snap.game, r.best)}`).join(', ')}
          </Txt>
        ) : null}

        <View style={[styles.stage, { height: pedH + chibi * 1.3 }]}>
          {order.map((i) => {
            const t = tiers[i];
            const step = Math.min(3, t.rank) - 1;
            const ph = pedH * PED[step].h;
            const one = t.list.length === 1 ? t.list[0] : null;
            return (
              <View key={t.rank} style={[styles.col, { width: pedW * t.list.length }]}>
                <View style={styles.row}>
                  {t.list.map((m) => (
                    <Chibi key={m} look={lookOf({ chibi: member(m)?.chibi })} emotion={t.rank === 1 ? 'joy' : 'calm'} value={t.rank === 1 ? (draw ? 70 : 95) : 55} pose={t.rank === 1 && !draw ? 'cheer' : 'idle'} size={chibi} />
                  ))}
                </View>
                <View style={[styles.ped, { height: ph, backgroundColor: PED[step].color }]}>
                  <Txt weight="display" size={26} color="#2B2035">
                    {t.rank}
                  </Txt>
                  <Txt weight="heavy" size={12.5} color="#2B2035" numberOfLines={1}>
                    {one ? (one === meId ? 'Ты' : (member(one)?.name ?? '—')) : t.list.map((m) => (m === meId ? 'Ты' : (member(m)?.name ?? '—'))).join(' · ')}
                  </Txt>
                  {value(t.list[0]) ? (
                    <Txt weight="bold" size={11.5} color="rgba(43,32,53,0.8)" numberOfLines={1}>
                      {value(t.list[0])}
                    </Txt>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
        {rest.length ? (
          <Txt weight="bold" size={13} muted center>
            {rest.map((m) => `${ranks[m]}. ${m === meId ? 'ты' : (member(m)?.name ?? '—')}${value(m) ? ` (${value(m)})` : ''}`).join(' · ')}
          </Txt>
        ) : null}

        {myRewards.map((r) => {
          const it = catalog.get(r.item_id);
          const look = myLook && it ? wear(myLook, it.cat as WearCat, it) : myLook;
          return (
            <View key={r.item_id} style={styles.reward}>
              {look ? <LookThumb look={look} crop={REWARD_CROP[r.item_id] ?? 'body'} size={72} /> : null}
              <View style={styles.flex}>
                <Txt weight="heavy" size={16}>
                  {it?.name ?? 'Награда'}
                </Txt>
                <Txt weight="bold" size={12.5} muted>
                  {REWARD_NOTE[r.item_id] ?? 'Награда'} · уже в инвентаре
                </Txt>
              </View>
            </View>
          );
        })}
        {otherRewards.length ? (
          <Txt weight="bold" size={13} muted center>
            {otherRewards
              .map((r) => {
                const m = members.find((x) => x.user_id === r.user_id);
                return `${m?.name ?? 'Кто-то'} получает «${catalog.get(r.item_id)?.name ?? 'награду'}»`;
              })
              .join(' · ')}
          </Txt>
        ) : null}
        {status ? (
          <Txt weight="bold" size={12.5} faint center>
            {status}
          </Txt>
        ) : null}

        <View style={styles.buttons}>
          <Button title="Закрыть" variant="secondary" onPress={onClose} style={styles.flex} />
          <Button title="Ещё раз" onPress={onAgain} loading={busy} icon="wheel" style={styles.flex} />
        </View>
        <Pressy onPress={onRecords} innerStyle={styles.link} accessibilityLabel="Рекорды комнаты">
          <Icon name="trophy" size={18} color="#FFD45E" />
          <Txt weight="heavy" size={14} color="#FFD45E">
            Рекорды
          </Txt>
        </Pressy>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { backgroundColor: 'rgba(8,5,18,0.72)' },
  scroll: { paddingHorizontal: 20, gap: 10, alignItems: 'stretch', justifyContent: 'center' },
  shadow: { textShadowColor: '#2B2035', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  record: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(94,211,160,0.16)', borderWidth: 1, borderColor: C.good },
  stage: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 6, marginTop: 6 },
  col: { alignItems: 'center' },
  row: { flexDirection: 'row', justifyContent: 'center' },
  ped: { alignSelf: 'stretch', alignItems: 'center', paddingTop: 6, borderRadius: 10, borderWidth: 2, borderColor: '#2B2035', marginTop: -6 },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 22, backgroundColor: 'rgba(255,212,94,0.12)', borderWidth: 1, borderColor: 'rgba(255,212,94,0.5)' },
  flex: { flex: 1 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 6 },
  link: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 38 },
});

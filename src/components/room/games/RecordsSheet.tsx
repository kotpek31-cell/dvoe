// «Рекорды» комнаты: по каждой игре — топ-3 по победам и лучшему результату, свои цифры, свои награды.
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { roomRecords, type GameRecord } from '../../../lib/api';
import { errorMessage } from '../../../lib/env';
import { GAME_IDS, type GameId } from '../../../lib/games/rules';
import { C } from '../../../theme';
import { Icon } from '../../Icon';
import { Sheet } from '../../Sheet';
import { Pressy, Txt } from '../../ui';
import { bestText } from './Podium';
import { GAME_COLOR, GAME_SHORT } from './PreGame';

const REWARDS: { name: string; need: number }[] = [
  { name: 'Кубок', need: 1 },
  { name: 'Корона', need: 10 },
  { name: 'Плащ', need: 25 },
];
const winsText = (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'победа' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'победы' : 'побед'}`;

export function RecordsSheet({ visible, onClose, userId, initial }: { visible: boolean; onClose: () => void; userId: string | null; initial?: GameId }) {
  const [game, setGame] = useState<GameId>(initial ?? 'stars');
  const [data, setData] = useState<{ records: GameRecord[]; my_wins: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (initial) setGame(initial);
    setError(null);
    roomRecords()
      .then(setData)
      .catch((e) => setError(errorMessage(e)));
  }, [visible, initial]);

  const rows = (data?.records ?? [])
    .filter((r) => r.game === game)
    .sort((a, b) => b.wins - a.wins || (game === 'reaction' ? (a.best ?? Infinity) - (b.best ?? Infinity) : (b.best ?? -1) - (a.best ?? -1)) || b.played - a.played);
  const top = rows.slice(0, 3);
  const mine = rows.find((r) => r.user_id === userId);
  const mineIn = top.some((r) => r.user_id === userId);
  const hasBest = game === 'stars' || game === 'reaction';

  return (
    <Sheet visible={visible} onClose={onClose} title="Рекорды">
      <View style={styles.tabs}>
        {GAME_IDS.map((g) => (
          <Pressy
            key={g}
            onPress={() => setGame(g)}
            style={styles.tabWrap}
            innerStyle={[styles.tab, g === game ? { backgroundColor: GAME_COLOR[g] } : null]}
            accessibilityRole="tab"
            accessibilityState={{ selected: g === game }}
            accessibilityLabel={GAME_SHORT[g]}
          >
            <Txt weight="heavy" size={12.5} color={g === game ? '#1A0F1F' : C.text} numberOfLines={1}>
              {GAME_SHORT[g]}
            </Txt>
          </Pressy>
        ))}
      </View>

      {error ? (
        <Txt muted size={14}>
          {error}
        </Txt>
      ) : !data ? (
        <Txt muted size={14}>
          Загружаем…
        </Txt>
      ) : (
        <View style={styles.table}>
          <View style={styles.row}>
            <Txt weight="bold" size={12} muted style={styles.place}>
              {' '}
            </Txt>
            <Txt weight="bold" size={12} muted style={styles.flex}>
              Игрок
            </Txt>
            <Txt weight="bold" size={12} muted style={styles.num}>
              Побед
            </Txt>
            {hasBest ? (
              <Txt weight="bold" size={12} muted style={styles.best}>
                Лучший
              </Txt>
            ) : null}
          </View>
          {top.length ? (
            top.map((r, i) => <RecordRow key={r.user_id} r={r} place={i + 1} me={r.user_id === userId} game={game} hasBest={hasBest} />)
          ) : (
            <Txt muted size={14}>
              Ещё никто не играл
            </Txt>
          )}
          {mine && !mineIn ? <RecordRow r={mine} place={rows.indexOf(mine) + 1} me game={game} hasBest={hasBest} /> : null}
          <Txt weight="bold" size={13} muted>
            {mine ? `Ты: сыграно ${mine.played}, ${winsText(mine.wins)}` : 'У тебя ещё нет партий в этой игре'}
          </Txt>
        </View>
      )}

      <View style={styles.line} />
      <Txt weight="display" size={14}>
        Мои награды
      </Txt>
      <View style={styles.rewards}>
        {REWARDS.map((r) => {
          const got = (data?.my_wins ?? 0) >= r.need;
          return (
            <View key={r.name} style={[styles.reward, got ? styles.rewardGot : null]}>
              <Icon name="trophy" size={20} color={got ? '#FFD45E' : C.faint} />
              <Txt weight="heavy" size={14} color={got ? '#FFD45E' : C.text}>
                {r.name}
              </Txt>
              <Txt weight="bold" size={12} muted>
                {winsText(r.need)}
              </Txt>
              <Txt weight="heavy" size={11.5} color={got ? C.good : C.muted}>
                {got ? 'есть' : 'впереди'}
              </Txt>
            </View>
          );
        })}
      </View>
      <Txt size={12.5} faint>
        Всего побед: {data?.my_wins ?? 0}. Считаются игры, где было хотя бы двое людей.
      </Txt>
    </Sheet>
  );
}

function RecordRow({ r, place, me, game, hasBest }: { r: GameRecord; place: number; me: boolean; game: GameId; hasBest: boolean }) {
  return (
    <View style={[styles.row, me ? styles.rowMe : null]}>
      <Txt weight="display" size={13} muted style={styles.place}>
        {place}
      </Txt>
      <Txt weight="heavy" size={14} style={styles.flex} numberOfLines={1}>
        {r.name ?? 'Кто-то'}
      </Txt>
      <Txt weight="display" size={13} style={styles.num}>
        {r.wins}
      </Txt>
      {hasBest ? (
        <Txt weight="heavy" size={13} color={C.good} style={styles.best}>
          {bestText(game, r.best) || '—'}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabs: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  tabWrap: { flex: 1 },
  tab: { height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)' },
  table: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 34, paddingHorizontal: 8, borderRadius: 12 },
  rowMe: { backgroundColor: 'rgba(143,162,255,0.14)' },
  place: { width: 20, textAlign: 'center' },
  num: { width: 52, textAlign: 'right' },
  best: { width: 84, textAlign: 'right' },
  line: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 14 },
  rewards: { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 8 },
  reward: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 12, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  rewardGot: { backgroundColor: 'rgba(255,212,94,0.14)', borderColor: '#FFD45E' },
});

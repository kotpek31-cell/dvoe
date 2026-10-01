// Ввод секретного кода. Код проверяет только сервер; при успехе — праздничная карточка
// с полученными вещами, конфетти и кнопкой «Надеть».
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { usePair } from '../context/PairProvider';
import { redeemCode, type RewardItem } from '../lib/api';
import { syncCatalog, useCatalog } from '../lib/catalog';
import { lookOf, wearAll } from '../lib/chibi';
import { errorMessage } from '../lib/env';
import { haptic } from '../lib/motion';
import { C, S } from '../theme';
import { Confetti } from './Effects';
import { Icon } from './Icon';
import { IconTile, LookThumb } from './ItemTile';
import { Sheet } from './Sheet';
import { Button, Input, Txt } from './ui';

const CONFETTI = [C.accent, C.me, C.partner, C.warn, C.good, C.sleep];
const HEAD = new Set(['hair', 'eyes', 'hat', 'face']);

type Props = {
  visible: boolean;
  onClose: () => void;
  onRedeemed?: () => void; // инвентарь изменился
  onWear: (ids: string[]) => void;
};

export function CodeSheet({ visible, onClose, onRedeemed, onWear }: Props) {
  const { me } = usePair();
  const catalog = useCatalog();
  const { width } = useWindowDimensions();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prize, setPrize] = useState<{ title: string; items: RewardItem[] } | null>(null);
  const [party, setParty] = useState(0);

  // Каждый раз открывается чистым
  useEffect(() => {
    if (!visible) return;
    setCode('');
    setError(null);
    setPrize(null);
  }, [visible]);

  const base = useMemo(() => lookOf(me), [me]);

  const submit = async () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await redeemCode(code);
      if (!res.ok) {
        haptic.warning();
        setError(res.message);
        return;
      }
      haptic.success();
      setPrize({ title: res.title, items: res.items });
      setParty((n) => n + 1);
      onRedeemed?.();
      if (res.items.some((it) => !catalog.has(it.id))) syncCatalog(true).catch(() => undefined);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const thumb = 74;

  return (
    <Sheet visible={visible} onClose={onClose} title={prize ? 'Получено!' : 'Секретный код'}>
      {prize ? (
        <>
          <Txt muted size={15}>
            {prize.title ? `Набор «${prize.title}» теперь твой.` : 'Новые вещи теперь твои.'} Они уже в гардеробе.
          </Txt>
          <View style={styles.prizes}>
            {prize.items.map((it) => {
              const item = catalog.get(it.id);
              const ability = it.cat === 'ability';
              return (
                <View key={it.id} style={[styles.prize, { width: thumb }]}>
                  <View style={[styles.prizeBox, { width: thumb, height: thumb }]}>
                    {ability || !item ? (
                      <IconTile icon={ability ? 'flame' : 'gift'} color={C.warn} />
                    ) : (
                      <LookThumb look={wearAll(base, [it.id], catalog)} crop={HEAD.has(it.cat) ? 'head' : it.cat === 'back' ? 'wide' : it.cat === 'top' ? 'torso' : 'body'} size={thumb} />
                    )}
                  </View>
                  <Txt weight="bold" size={12} center numberOfLines={2}>
                    {it.name}
                  </Txt>
                </View>
              );
            })}
          </View>
          <Button title="Надеть" icon="hanger" onPress={() => onWear(prize.items.map((it) => it.id))} />
          <Button title="Позже" variant="ghost" onPress={onClose} />
        </>
      ) : (
        <>
          <View style={styles.teaser}>
            <Icon name="key" size={22} color={C.warn} />
            <Txt muted size={15} style={styles.flex}>
              Никто не знает, что будет…
            </Txt>
          </View>
          <Input
            value={code}
            onChangeText={(t) => {
              setCode(t);
              if (error) setError(null);
            }}
            placeholder="Введи код"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            maxLength={100}
            returnKeyType="done"
            onSubmitEditing={submit}
            accessibilityLabel="Секретный код"
          />
          {error ? (
            <Txt color={C.bad} size={14} weight="bold">
              {error}
            </Txt>
          ) : null}
          <Button title="Активировать" icon="sparkle" onPress={submit} loading={busy} disabled={!code.trim()} />
        </>
      )}
      <View pointerEvents="none" style={styles.confetti}>
        <Confetti trigger={party} colors={CONFETTI} width={width} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  teaser: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  prizes: { flexDirection: 'row', flexWrap: 'wrap', gap: S.md, justifyContent: 'center', paddingVertical: S.xs },
  prize: { alignItems: 'center', gap: 4 },
  prizeBox: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,194,102,0.45)',
    backgroundColor: 'rgba(255,194,102,0.1)',
    overflow: 'hidden',
  },
  confetti: { position: 'absolute', left: 0, right: 0, top: 150 },
});

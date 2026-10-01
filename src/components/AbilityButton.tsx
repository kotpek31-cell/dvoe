// Кнопка способности на главной: круглая стеклянная, справа внизу над вкладками, со значком надетой способности.
// Нажатие — применить; по краю бежит кольцо перезарядки и видно, сколько осталось.
// Долгое нажатие — панель быстрой смены. Партнёр спит — кнопка неактивна: «Тсс, {имя} спит».
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useAbility } from '../context/AbilityProvider';
import { usePair } from '../context/PairProvider';
import { abilityInfo, cooldownMs, leftLabel } from '../lib/abilities';
import { fetchInventory, updateMyProfile } from '../lib/api';
import { useCatalog } from '../lib/catalog';
import { DEFAULT_ABILITY, lookOf, lookToChibi } from '../lib/chibi';
import { haptic } from '../lib/motion';
import { prepareSounds } from '../lib/sound';
import { C, R, S } from '../theme';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Button, Pressy, Txt } from './ui';

const SIZE = 64;
const RING = 29;
const CIRC = 2 * Math.PI * RING;

// Сколько осталось до конца перезарядки; пока идёт — тикает
function useLeft(until: number | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  const left = until ? Math.max(0, until - now) : 0;
  useEffect(() => {
    if (!until || until <= Date.now()) return;
    const step = until - Date.now() > 60_000 ? 1000 : 200;
    const t = setInterval(() => setNow(Date.now()), step);
    return () => clearInterval(t);
  }, [until, left > 60_000]); // eslint-disable-line react-hooks/exhaustive-deps
  return left;
}

export function AbilityButton({ onMessage, busy }: { onMessage: (text: string) => void; busy: boolean }) {
  const { me, partner, refresh } = usePair();
  const { cast, cooldowns } = useAbility();
  const catalog = useCatalog();
  const insets = useSafeAreaInsets();
  const [sending, setSending] = useState(false);
  const [picker, setPicker] = useState(false);
  const [owned, setOwned] = useState<Set<string> | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const look = me ? lookOf(me) : null;
  const equipped = look?.ability ?? DEFAULT_ABILITY;
  const info = abilityInfo(equipped);
  const left = useLeft(cooldowns[equipped]);
  const total = cooldownMs(equipped, catalog);
  const sleeping = Boolean(partner?.sleeping_since);
  const name = partner?.display_name ?? 'Партнёр';

  useEffect(() => {
    prepareSounds(equipped === 'ability.mog' ? ['mog', 'tension', 'hit'] : ['chime']);
  }, [equipped]);

  // Список для панели: бесплатные — у всех, остальные — из инвентаря
  useEffect(() => {
    if (!picker) return;
    fetchInventory()
      .then((rows) => setOwned(new Set(rows.map((r) => r.item_id))))
      .catch(() => setOwned(new Set()));
  }, [picker]);
  const abilities = useMemo(
    () =>
      [...catalog.values()]
        .filter((it) => it.cat === 'ability' && (it.source === 'free' || it.id === equipped || owned?.has(it.id)))
        .sort((a, b) => a.sort - b.sort),
    [catalog, owned, equipped],
  );

  if (!me || !partner) return null;

  const press = async () => {
    if (sleeping) {
      haptic.warning();
      onMessage(`Тсс, ${name} спит`);
      return;
    }
    if (left > 0) {
      haptic.light();
      onMessage(`Перезарядка: ещё ${leftLabel(left)}`);
      return;
    }
    if (busy || sending) return;
    haptic.medium();
    setSending(true);
    const res = await cast(equipped);
    setSending(false);
    if (!res.ok) {
      haptic.warning();
      onMessage(res.message);
    }
  };

  const choose = async (id: string) => {
    if (id === equipped) {
      setPicker(false);
      return;
    }
    setSaving(id);
    try {
      await updateMyProfile(me.id, { chibi: lookToChibi({ ...lookOf(me), ability: id }) });
      await refresh();
      haptic.success();
      setPicker(false);
    } catch (e) {
      onMessage(e instanceof Error ? e.message : 'Не получилось');
    } finally {
      setSaving(null);
    }
  };

  const cooling = left > 0;
  const dim = sleeping || cooling;

  return (
    <>
      <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 10) + 6 + 68 + 14 }]}>
        {sleeping ? (
          <View style={styles.hint} pointerEvents="none">
            <Icon name="sleep" size={15} color={C.sleep} fill={C.sleep} strokeWidth={1.4} />
            <Txt weight="heavy" size={13} numberOfLines={1}>
              Тсс, {name} спит
            </Txt>
          </View>
        ) : null}
        <Pressy
          onPress={press}
          onLongPress={() => {
            haptic.medium();
            setPicker(true);
          }}
          haptics={false}
          scaleTo={0.9}
          accessibilityLabel={
            sleeping
              ? `${info.sub}. Сейчас нельзя: ${name} спит. Подержи, чтобы сменить способность`
              : cooling
                ? `Перезарядка, ещё ${leftLabel(left)}. Подержи, чтобы сменить способность`
                : `Применить «${catalog.get(equipped)?.name ?? 'способность'}». Подержи, чтобы сменить`
          }
        >
          <View style={[styles.button, { borderColor: cooling || sleeping ? C.glassBorder : `${info.color}88` }]}>
            <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill} pointerEvents="none">
              {cooling ? (
                <>
                  <Circle cx={SIZE / 2} cy={SIZE / 2} r={RING} stroke="rgba(255,255,255,0.14)" strokeWidth={3.5} fill="none" />
                  <Circle
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RING}
                    stroke={info.color}
                    strokeWidth={3.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${CIRC} ${CIRC}`}
                    strokeDashoffset={CIRC * (1 - Math.min(1, left / total))}
                    transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                  />
                </>
              ) : null}
            </Svg>
            {sending ? (
              <ActivityIndicator color={info.color} />
            ) : (
              <View style={{ opacity: dim ? 0.45 : 1 }}>
                <Icon name={info.icon} size={28} color={info.color} fill={`${info.color}55`} strokeWidth={2.1} />
              </View>
            )}
          </View>
        </Pressy>
        {cooling ? (
          <View style={styles.left} pointerEvents="none">
            <Txt weight="display" size={10.5} color={C.text}>
              {leftLabel(left)}
            </Txt>
          </View>
        ) : null}
      </View>

      <Sheet visible={picker} onClose={() => setPicker(false)} title="Способность">
        <Txt muted size={14}>
          Надета может быть одна. Нажми на кнопку на главной — и она сработает у {name}.
        </Txt>
        <View style={styles.list}>
          {abilities.map((it) => {
            const t = abilityInfo(it.id);
            const on = it.id === equipped;
            const l = (cooldowns[it.id] ?? 0) - Date.now();
            return (
              <Pressy
                key={it.id}
                onPress={() => choose(it.id)}
                innerStyle={[styles.row, on ? styles.rowOn : null]}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${it.name}, ${t.sub}`}
              >
                <View style={[styles.rowIcon, { backgroundColor: `${t.color}2E` }]}>
                  <Icon name={t.icon} size={24} color={t.color} fill={`${t.color}55`} />
                </View>
                <View style={styles.flex}>
                  <Txt weight="heavy" size={16}>
                    {it.name}
                  </Txt>
                  <Txt muted size={13}>
                    {l > 0 ? `перезарядка ещё ${leftLabel(l)}` : t.sub}
                  </Txt>
                </View>
                {saving === it.id ? (
                  <ActivityIndicator color={C.accent} />
                ) : on ? (
                  <Icon name="check" size={22} color={C.accent} strokeWidth={2.6} />
                ) : null}
              </Pressy>
            );
          })}
        </View>
        <Button
          title="Открыть гардероб"
          icon="hanger"
          variant="secondary"
          onPress={() => {
            setPicker(false);
            router.push('/wardrobe');
          }}
        />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { position: 'absolute', right: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28,23,48,0.78)',
    borderWidth: 1.5,
    boxShadow: '0px 10px 24px rgba(8,4,20,0.4)',
  },
  left: {
    position: 'absolute',
    right: 0,
    bottom: -9,
    width: SIZE,
    alignItems: 'center',
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: R.pill,
    backgroundColor: 'rgba(24,18,40,0.78)',
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  list: { gap: S.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    padding: S.md,
    borderRadius: R.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  rowOn: { borderColor: C.accent, backgroundColor: 'rgba(255,107,138,0.14)' },
  rowIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});

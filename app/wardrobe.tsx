// Гардероб = инвентарь: сверху живой чибик в примеряемом образе, снизу вещи.
// Образ меняется только на экране, пока не нажать «Сохранить»; сервер проверяет каждую вещь.
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aurora } from '../src/components/Aurora';
import { Chibi } from '../src/components/Chibi';
import { CodeSheet } from '../src/components/CodeSheet';
import { HeartsBurst } from '../src/components/Effects';
import { Icon, type IconName } from '../src/components/Icon';
import { IconTile, LookThumb, Tile, type Crop } from '../src/components/ItemTile';
import { Sheet } from '../src/components/Sheet';
import { Button, ErrorBox, IconButton, Pressy, Txt, showError } from '../src/components/ui';
import { usePair } from '../src/context/PairProvider';
import { abilityInfo } from '../src/lib/abilities';
import { fetchInventory, updateMyProfile } from '../src/lib/api';
import { useCatalog, type ItemRow } from '../src/lib/catalog';
import {
  CHIBI_KINDS,
  CHIBI_LABELS,
  DEFAULT_ABILITY,
  lookOf,
  lookToChibi,
  LOOKS,
  recolor,
  sameLook,
  wear,
  wearAll,
  type Look,
  type Slot,
  type WearCat,
} from '../src/lib/chibi';
import { useScreenFocused } from '../src/lib/focus';
import { useLoader } from '../src/lib/hooks';
import { haptic } from '../src/lib/motion';
import { CLOTH, HAIR, SKIN } from '../src/lib/palette';
import { C, R, S } from '../src/theme';

type Cat = WearCat | 'body' | 'skin' | 'ability';
type Section = { key: string; label: string; icon: IconName; cats: Cat[] };

const SECTIONS: Section[] = [
  { key: 'look', label: 'Внешность', icon: 'mood', cats: ['body', 'skin', 'hair', 'eyes'] },
  { key: 'clothes', label: 'Одежда', icon: 'shirt', cats: ['hat', 'face', 'top', 'bottom', 'shoes', 'back'] },
  { key: 'items', label: 'Предметы', icon: 'gift', cats: ['hand'] },
  { key: 'abilities', label: 'Способности', icon: 'sparkle', cats: ['ability'] },
];

const CAT_LABELS: Record<Cat, string> = {
  body: 'Тело',
  skin: 'Кожа',
  hair: 'Причёски',
  eyes: 'Глаза',
  hat: 'Шляпы',
  face: 'Лицо',
  top: 'Верх',
  bottom: 'Низ',
  shoes: 'Обувь',
  back: 'Спина',
  hand: 'В руках',
  ability: 'Способности',
};

const SKIN_LABELS = ['Светлая', 'Персик', 'Медовая', 'Карамель', 'Какао'];
const REQUIRED = new Set<Cat>(['body', 'skin', 'eyes', 'top', 'ability']);
const CROP: Partial<Record<Cat, Crop>> = { skin: 'head', hair: 'head', eyes: 'head', hat: 'head', face: 'head', top: 'torso', back: 'wide' };


const slotOf = (look: Look, cat: WearCat): Slot | null => (look as Record<WearCat, Slot | null | undefined>)[cat] ?? null;

export default function WardrobeScreen() {
  const { me, refresh } = usePair();
  const catalog = useCatalog();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ wear?: string }>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const focused = useScreenFocused();

  const base = useMemo(() => lookOf(me), [me]);
  const [draft, setDraft] = useState<Look>(base);
  const [section, setSection] = useState(SECTIONS[0]);
  const [cat, setCat] = useState<Cat>('body');
  const [newest, setNewest] = useState(false);
  const [saving, setSaving] = useState(false);
  const [codes, setCodes] = useState(false);
  const [leaving, setLeaving] = useState<null | (() => void)>(null);
  const [hearts, setHearts] = useState(0);
  const [gridW, setGridW] = useState(Math.min(width, 560) - S.lg * 2);

  const dirty = !sameLook(draft, base);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // Образ в профиле изменился (сохранили, или пришёл с другого телефона) — если правок нет, берём его
  const lastBase = useRef(base);
  useEffect(() => {
    if (lastBase.current === base) return;
    if (sameLook(draft, lastBase.current)) setDraft(base);
    lastBase.current = base;
  }, [base, draft]);

  // Пришли из окна кода с кнопкой «Надеть»
  const worePrize = useRef(false);
  useEffect(() => {
    if (worePrize.current || !params.wear) return;
    worePrize.current = true;
    setDraft((d) => wearAll(d, params.wear!.split(','), catalog));
  }, [params.wear, catalog]);

  const { data: inventory, error, reload } = useLoader(fetchInventory, []);
  const owned = useMemo(() => new Map((inventory ?? []).map((r) => [r.item_id, r.granted_at])), [inventory]);

  // Вещи категории: бесплатные — у всех, остальные — только свои (и то, что уже надето)
  const itemsOf = useCallback(
    (c: Cat): ItemRow[] => {
      const worn = c === 'ability' ? draft.ability ?? DEFAULT_ABILITY : c === 'body' || c === 'skin' ? null : slotOf(draft, c)?.id;
      const list = [...catalog.values()].filter((it) => it.cat === c && (it.source === 'free' || owned.has(it.id) || it.id === worn));
      if (!newest) return list.sort((a, b) => a.sort - b.sort);
      const at = (it: ItemRow) => owned.get(it.id) ?? '';
      return list.sort((a, b) => at(b).localeCompare(at(a)) || b.sort - a.sort);
    },
    [catalog, owned, draft, newest],
  );

  // ---------- выход без сохранения ----------
  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', (e) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      setLeaving(() => () => navigation.dispatch(e.data.action));
    });
    return sub;
  }, [navigation]);

  const save = async (): Promise<boolean> => {
    if (!me) return false;
    setSaving(true);
    try {
      await updateMyProfile(me.id, { chibi: lookToChibi(draft) });
      haptic.success();
      setHearts((n) => n + 1);
      dirtyRef.current = false;
      await refresh();
      return true;
    } catch (e) {
      showError(e, 'Образ не сохранился');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/profile');
  };

  if (!me) return <View style={styles.root} />;

  // ---------- размеры ----------
  const contentW = Math.min(width, 560);
  const chibiSize = Math.round(Math.max(92, Math.min(138, height * 0.16)));
  const feet = 4 + (chibiSize * 153) / 120; // где стоят ноги чибика на подиуме
  const tile = Math.floor((gridW - S.sm * 2) / 3);

  const pickSection = (s: Section) => {
    setSection(s);
    setCat(s.cats[0]);
  };

  // ---------- плитки ----------
  const tiles: ReactNode[] = [];
  const crop = CROP[cat] ?? 'body';

  if (cat === 'body') {
    CHIBI_KINDS.forEach((kind) =>
      tiles.push(
        <Tile
          key={kind}
          size={tile}
          label={CHIBI_LABELS[kind]}
          selected={draft.kind === kind}
          onPress={() => setDraft((d) => ({ ...LOOKS[kind], skin: d.skin, ability: d.ability }))}
        >
          <LookThumb look={{ ...LOOKS[kind], skin: draft.skin }} crop="body" size={tile} />
        </Tile>,
      ),
    );
  } else if (cat === 'skin') {
    SKIN.forEach((_, i) =>
      tiles.push(
        <Tile key={i} size={tile} label={SKIN_LABELS[i] ?? `Тон ${i + 1}`} selected={draft.skin === i} onPress={() => setDraft((d) => ({ ...d, skin: i }))}>
          <LookThumb look={{ ...draft, skin: i }} crop="head" size={tile} />
        </Tile>,
      ),
    );
  } else if (cat === 'ability') {
    const current = draft.ability ?? DEFAULT_ABILITY;
    itemsOf('ability').forEach((it) => {
      const t = abilityInfo(it.id);
      tiles.push(
        <Tile key={it.id} size={tile} label={it.name} selected={current === it.id} exclusive={it.source !== 'free'} onPress={() => setDraft((d) => ({ ...d, ability: it.id }))}>
          <IconTile icon={t.icon} color={t.color} sub={t.sub} />
        </Tile>,
      );
    });
  } else {
    const wc = cat as WearCat;
    const slot = slotOf(draft, wc);
    if (!REQUIRED.has(cat)) {
      tiles.push(
        <Tile key="none" size={tile} label="Без ничего" selected={!slot} onPress={() => setDraft((d) => wear(d, wc, null))}>
          <IconTile icon="close" />
        </Tile>,
      );
    }
    itemsOf(wc).forEach((it) => {
      const selected = slot?.id === it.id;
      tiles.push(
        <Tile
          key={it.id}
          size={tile}
          label={it.name}
          selected={selected}
          exclusive={it.source !== 'free'}
          onPress={() => setDraft((d) => (selected ? d : wear(d, wc, it)))}
        >
          <LookThumb look={selected ? draft : wear(draft, wc, it)} crop={crop} size={tile} />
        </Tile>,
      );
    });
  }
  tiles.push(
    <Tile key="code" size={tile} label="Ввести код" onPress={() => setCodes(true)}>
      <IconTile icon="key" color={C.warn} dashed />
    </Tile>,
  );

  // ---------- цвета выбранной вещи ----------
  let colors: { key: string; hex: string; name: string }[] = [];
  let colorKey: string | undefined;
  if (cat !== 'body' && cat !== 'skin' && cat !== 'ability') {
    const slot = slotOf(draft, cat);
    const item = slot ? catalog.get(slot.id) : undefined;
    if (slot && item?.palette) {
      const pal = item.palette === 'hair' ? HAIR : CLOTH;
      colors = Object.entries(pal).map(([key, [name, hex]]) => ({ key, hex, name }));
      colorKey = slot.c ?? item.def_color ?? undefined;
    }
  }
  const dressCoversBottom = cat === 'bottom' && Boolean(draft.top && catalog.get(draft.top.id)?.meta.coversBottom);

  return (
    <View style={styles.root}>
      <Aurora paused={!focused} />
      <View style={[styles.column, { width: contentW, paddingTop: insets.top + 10 }]}>
        <View style={styles.header}>
          <IconButton icon="back" label="Назад" onPress={goBack} size={42} />
          <Txt weight="display" size={22} style={styles.flex} numberOfLines={1}>
            Гардероб
          </Txt>
          <IconButton icon="key" label="Ввести код" onPress={() => setCodes(true)} size={42} color={C.warn} />
        </View>

        {/* подиум */}
        <View style={styles.podium}>
          <View style={[styles.glow, { width: chibiSize * 1.7, height: chibiSize * 0.34, top: feet - chibiSize * 0.17 }]} />
          <View style={[styles.stage, { width: chibiSize * 1.1, height: chibiSize * 0.18, top: feet - chibiSize * 0.09 }]} />
          <Pressy onPress={() => setHearts((n) => n + 1)} haptics={false} scaleTo={0.96} accessibilityLabel="Твой чибик в примеряемом образе">
            <Chibi look={draft} emotion="joy" value={dirty ? 70 : 45} pose="idle" size={chibiSize} />
          </Pressy>
          <HeartsBurst trigger={hearts} x={contentW / 2} y={chibiSize * 0.5} scale={0.9} />
          <View style={styles.actions}>
            <Button title="Отменить" icon="undo" variant="secondary" small onPress={() => setDraft(base)} disabled={!dirty || saving} />
            <Button title="Сохранить" icon="check" small onPress={save} loading={saving} disabled={!dirty} />
          </View>
        </View>

        {/* разделы */}
        <View style={styles.sections} accessibilityRole="tablist">
          {SECTIONS.map((s) => {
            const active = s.key === section.key;
            return (
              <Pressy
                key={s.key}
                onPress={() => pickSection(s)}
                style={styles.flex}
                scaleTo={0.94}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={s.label}
                innerStyle={[styles.sectionBtn, active ? styles.sectionActive : null]}
              >
                <Icon name={s.icon} size={20} color={active ? C.accent : C.muted} />
                <Txt weight="heavy" size={11.5} color={active ? C.text : C.muted} numberOfLines={1}>
                  {s.label}
                </Txt>
              </Pressy>
            );
          })}
        </View>

        {section.cats.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chips}>
            {section.cats.map((c) => {
              const active = c === cat;
              return (
                <Pressy
                  key={c}
                  onPress={() => setCat(c)}
                  scaleTo={0.92}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  innerStyle={[styles.chip, active ? styles.chipActive : null]}
                >
                  <Txt weight="heavy" size={13} color={active ? C.onAccent : C.text}>
                    {CAT_LABELS[c]}
                  </Txt>
                </Pressy>
              );
            })}
          </ScrollView>
        ) : null}

        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.gridWrap, { paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}
          onLayout={(e) => setGridW(e.nativeEvent.layout.width - S.lg * 2)}
        >
          <View style={styles.gridHead}>
            <Txt weight="displaySemi" size={15} style={styles.flex}>
              {CAT_LABELS[cat]}
            </Txt>
            {cat !== 'body' && cat !== 'skin' && cat !== 'ability' ? (
              <Pressy
                onPress={() => setNewest((v) => !v)}
                scaleTo={0.92}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: newest }}
                innerStyle={[styles.sort, newest ? styles.sortOn : null]}
              >
                <Icon name="sort" size={15} color={newest ? C.accent : C.muted} />
                <Txt weight="bold" size={12} color={newest ? C.text : C.muted}>
                  {newest ? 'Сначала новые' : 'По порядку'}
                </Txt>
              </Pressy>
            ) : null}
          </View>

          {error ? <ErrorBox message={error} onRetry={reload} /> : null}
          {dressCoversBottom ? (
            <Txt faint size={13}>
              Платье закрывает низ — он появится, если надеть другой верх.
            </Txt>
          ) : null}
          {cat === 'body' ? (
            <Txt faint size={13}>
              Тело задаёт образ по умолчанию — дальше можно переодеть как угодно.
            </Txt>
          ) : null}

          <View style={[styles.grid, { gap: S.sm }]}>{tiles}</View>

          {colors.length ? (
            <View style={styles.colorsBox}>
              <Txt weight="heavy" size={12} color={C.faint} style={styles.upper}>
                Цвет
              </Txt>
              <View style={styles.colors}>
                {colors.map((c) => {
                  const active = c.key === colorKey;
                  return (
                    <Pressy
                      key={c.key}
                      onPress={() => setDraft((d) => recolor(d, cat as WearCat, c.key))}
                      scaleTo={0.85}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      accessibilityLabel={c.name}
                      style={styles.swatchCell}
                      innerStyle={[styles.swatchRing, active ? styles.swatchRingOn : null]}
                    >
                      <View style={[styles.swatch, { backgroundColor: c.hex }]} />
                    </Pressy>
                  );
                })}
              </View>
              <Txt muted size={13}>
                {colors.find((c) => c.key === colorKey)?.name ?? ''}
              </Txt>
            </View>
          ) : null}
        </ScrollView>
      </View>

      <CodeSheet
        visible={codes}
        onClose={() => setCodes(false)}
        onRedeemed={reload}
        onWear={(ids) => {
          setCodes(false);
          setDraft((d) => wearAll(d, ids, catalog));
        }}
      />

      <Sheet visible={leaving !== null} onClose={() => setLeaving(null)} title="Сохранить образ?">
        <Txt muted size={15}>
          Ты переодел(а) чибика, но не сохранил(а). Без сохранения образ вернётся к прежнему.
        </Txt>
        <Button
          title="Сохранить"
          icon="check"
          loading={saving}
          onPress={async () => {
            const go = leaving;
            if (await save()) {
              setLeaving(null);
              go?.();
            }
          }}
        />
        <Button
          title="Не сохранять"
          variant="secondary"
          onPress={() => {
            const go = leaving;
            dirtyRef.current = false;
            setLeaving(null);
            go?.();
          }}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  column: { flex: 1, alignSelf: 'center' },
  flex: { flex: 1 },
  upper: { textTransform: 'uppercase', letterSpacing: 0.6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingHorizontal: S.lg, minHeight: 48 },
  podium: { alignItems: 'center', paddingTop: 4, paddingBottom: S.sm },
  glow: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(155,140,255,0.1)', boxShadow: '0px 0px 30px rgba(255,107,138,0.3)' },
  stage: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,158,187,0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,158,187,0.5)',
  },
  actions: { flexDirection: 'row', gap: S.sm, marginTop: S.lg },
  sections: { flexDirection: 'row', gap: 6, paddingHorizontal: S.lg, marginTop: 2 },
  sectionBtn: {
    alignItems: 'center',
    gap: 3,
    paddingVertical: 8,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.glassBorder,
    backgroundColor: C.glass,
  },
  sectionActive: { borderColor: 'rgba(255,143,168,0.55)', backgroundColor: 'rgba(255,107,138,0.18)' },
  chipsScroll: { flexGrow: 0, marginTop: S.sm },
  chips: { gap: 6, paddingHorizontal: S.lg },
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: R.pill,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  gridWrap: { paddingHorizontal: S.lg, paddingTop: S.md, gap: S.md },
  gridHead: { flexDirection: 'row', alignItems: 'center', gap: S.sm, minHeight: 32 },
  sort: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: C.glassBorder,
    backgroundColor: C.glass,
  },
  sortOn: { borderColor: 'rgba(255,143,168,0.5)' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  colorsBox: {
    gap: S.sm,
    padding: S.md,
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: C.glassBorder,
    backgroundColor: C.glass,
  },
  colors: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 },
  swatchCell: { width: '20%', alignItems: 'center' },
  swatchRing: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  swatchRingOn: { borderColor: C.text },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: C.ink },
});

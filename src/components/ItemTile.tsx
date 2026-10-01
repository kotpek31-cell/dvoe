// Плитка гардероба: неподвижный чибик в примеряемой вещи, обрезанный по нужной части тела.
// Шляпы, волосы, глаза, лицо и кожа — крупно голова; верх — по пояс; остальное — чибик целиком.
import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { sameLook, type Look } from '../lib/chibi';
import { C, R } from '../theme';
import { Chibi } from './Chibi';
import { Icon, type IconName } from './Icon';
import { Pressy, Txt } from './ui';

export type Crop = 'head' | 'torso' | 'body' | 'wide';

// Область рисунка чибика (координаты 120×170), которую показывает плитка
const AREA: Record<Crop, { x0: number; x1: number; y0: number; y1: number }> = {
  head: { x0: 6, x1: 114, y0: -6, y1: 108 },
  torso: { x0: 0, x1: 120, y0: 14, y1: 146 },
  body: { x0: -6, x1: 126, y0: -8, y1: 174 },
  wide: { x0: -28, x1: 148, y0: -24, y1: 176 },
};

type ThumbProps = { look: Look; crop: Crop; size: number };

function LookThumbView({ look, crop, size }: ThumbProps) {
  const a = AREA[crop];
  const k = (size * 0.94) / Math.max(a.x1 - a.x0, a.y1 - a.y0);
  const left = (size - (a.x1 - a.x0) * k) / 2 - a.x0 * k;
  const top = (size - (a.y1 - a.y0) * k) / 2 - a.y0 * k;
  return (
    <View style={[styles.thumb, { width: size, height: size }]} pointerEvents="none">
      <View style={{ position: 'absolute', left, top }}>
        <Chibi look={look} emotion="joy" value={30} pose="idle" size={120 * k} still />
      </View>
    </View>
  );
}

// Перерисовываем, только если образ правда другой (плитки получают новые объекты образа)
export const LookThumb = memo(LookThumbView, (a, b) => a.crop === b.crop && a.size === b.size && sameLook(a.look, b.look));

type TileProps = {
  size: number;
  label: string;
  selected?: boolean;
  exclusive?: boolean; // вещь по коду — маленькая искорка в углу
  onPress: () => void;
  children: ReactNode;
};

export function Tile({ size, label, selected, exclusive, onPress, children }: TileProps) {
  return (
    <Pressy
      onPress={onPress}
      scaleTo={0.93}
      style={{ width: size }}
      accessibilityRole="radio"
      accessibilityState={{ checked: Boolean(selected) }}
      accessibilityLabel={label}
    >
      <View style={[styles.tile, { width: size, height: size }, selected ? styles.selected : null]}>
        {children}
        {exclusive ? (
          <View style={styles.badge}>
            <Icon name="sparkle" size={12} color={C.warn} fill={C.warn} strokeWidth={1.5} />
          </View>
        ) : null}
        {selected ? (
          <View style={styles.check}>
            <Icon name="check" size={12} color={C.onAccent} strokeWidth={3} />
          </View>
        ) : null}
      </View>
      <Txt weight={selected ? 'heavy' : 'bold'} size={12} center numberOfLines={1} color={selected ? C.text : C.muted} style={styles.label}>
        {label}
      </Txt>
    </Pressy>
  );
}

// Плитка без чибика: значок посередине («без ничего», «ввести код», способность)
export function IconTile({ icon, color = C.faint, dashed, sub }: { icon: IconName; color?: string; dashed?: boolean; sub?: string }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.iconTile, dashed ? styles.dashed : null]}>
      <Icon name={icon} size={30} color={color} />
      {sub ? (
        <Txt faint size={11} center numberOfLines={2}>
          {sub}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { overflow: 'hidden', borderRadius: R.lg },
  tile: {
    borderRadius: R.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.045)',
    overflow: 'hidden',
  },
  selected: { borderColor: C.accent, borderWidth: 2, backgroundColor: 'rgba(255,107,138,0.16)' },
  badge: {
    position: 'absolute',
    left: 6,
    top: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(22,18,38,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { marginTop: 5 },
  iconTile: { alignItems: 'center', justifyContent: 'center', gap: 4, padding: 8, borderRadius: R.lg },
  dashed: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.22)' },
});

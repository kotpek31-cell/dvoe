// Локация на всю площадку комнаты: небо одно на экран (стоит на месте), земля с деталями — плитками
// шириной в экран по всему миру, через одну зеркально (швы совпадают; плитки внахлёст на несколько пикселей, чтобы не было щели).
// Мир двигает родитель (камера).
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LocationId } from '../../lib/locations';
import type { DayTime } from '../../lib/scene';
import { Location } from '../scene/Location';

const SEAM = 3;

type Props = { id: LocationId; width: number; height: number; tiles: number; time: DayTime; active: boolean };

export const WideSky = memo(function WideSky({ id, width, height, time }: Omit<Props, 'tiles' | 'active'>) {
  return <Location id={id} width={width} height={height} time={time} active={false} part="sky" />;
});

export const WideLand = memo(function WideLand({ id, width, height, tiles, time, active }: Props) {
  return (
    <View pointerEvents="none" style={[styles.row, { width: width * tiles, height }]}>
      {Array.from({ length: tiles }, (_, i) => (
        <View key={i} style={{ position: 'absolute', left: i * width - (i ? SEAM : 0), top: 0, width: width + SEAM * 2, height, transform: i % 2 ? [{ scaleX: -1 }] : [] }}>
          <Location id={id} width={width + SEAM * 2} height={height} time={time} active={active} part="land" />
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { position: 'absolute', left: 0, top: 0 },
});

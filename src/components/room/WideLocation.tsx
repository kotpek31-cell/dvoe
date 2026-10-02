// Локация на всю площадку комнаты: небо одно на экран (стоит на месте), земля с деталями — плитками
// шириной в экран по всему миру (плитки внахлёст на несколько пикселей, чтобы не было щели).
// Этап фиксации 0.2: середина — как на главной, по бокам — свои варианты (без двойников); соседние плитки зеркальны,
// чтобы земля на швах сходилась (tileLayout в roomWorld.ts).
// Мир двигает родитель (камера).
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LocationId } from '../../lib/locations';
import { tileLayout } from '../../lib/roomWorld';
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
      {tileLayout(tiles).map(({ mirror, variant }, i) => (
        <View key={i} style={{ position: 'absolute', left: i * width - (i ? SEAM : 0), top: 0, width: width + SEAM * 2, height, transform: mirror ? [{ scaleX: -1 }] : [] }}>
          <Location id={id} width={width + SEAM * 2} height={height} time={time} active={active} part="land" variant={variant} />
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { position: 'absolute', left: 0, top: 0 },
});

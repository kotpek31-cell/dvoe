// Время суток на сцене и перевод координат сцены (390×844) в экранные.
// Рисунки мест (и луга тоже) — в locations.ts.

export type DayTime = 'day' | 'evening' | 'night';

export function dayTimeOf(date: Date = new Date()): DayTime {
  const h = date.getHours();
  if (h >= 21 || h < 5) return 'night';
  if (h >= 17 || h < 7) return 'evening';
  return 'day';
}

export const SCENE_W = 390;
export const SCENE_H = 844;

// Сцена заполняет экран целиком и прижата к низу (как preserveAspectRatio="xMidYMax slice")
export function sceneTransform(width: number, height: number) {
  const s = Math.max(width / SCENE_W, height / SCENE_H);
  const ox = width / 2 - (SCENE_W / 2) * s;
  const oy = height - SCENE_H * s;
  return { s, x: (sx: number) => ox + sx * s, y: (sy: number) => oy + sy * s };
}

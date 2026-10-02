// Площадка комнаты (и главной): мир шире экрана, земля с глубиной.
// Место чибика — доли: x — по ширине мира (0…1), y — по глубине земли (0 — дальний край, 1 — ближний).
// Пиксели считаем на каждом телефоне сами: доли одинаковые у всех, поэтому все видят одно и то же место.
// Mover — один ходок: двигает Animated-значения (ноги в точке мира) и сообщает, идёт ли он и куда смотрит.
import { Animated, Easing } from 'react-native';
import { caveRocks, crystalsOf, type LocationId, type Variant } from './locations';
import { nativeDriver } from './motion';
import { sceneTransform } from './scene';

export const NEAR_Y = 748; // ближний край земли в координатах сцены 390×844 (где стоят ноги)
const DEPTH = 125; // глубина земли на главной; в комнате — × world_d

export type Geo = {
  width: number; // экран
  height: number;
  worldW: number; // мир в пикселях
  tiles: number; // сколько экранов-плиток земли
  s: number; // масштаб сцены
  farPx: number; // ноги на дальнем краю
  nearPx: number; // ноги на ближнем краю
  base: number; // ширина чибика на ближнем краю
  kFar: number; // во сколько раз меньше на дальнем краю
  margin: number;
  sceneX: (sx: number) => number; // x сцены → x экрана (внутри одной плитки)
};

export function makeGeo(width: number, height: number, worldScreens = 1, depth = 1, home = false): Geo {
  const tf = sceneTransform(width, height);
  const tiles = Math.max(1, Math.ceil(worldScreens - 0.001));
  const far = NEAR_Y - DEPTH * depth;
  const base = Math.round(104 * tf.s * (home ? 1.02 : 0.98));
  return {
    width,
    height,
    worldW: Math.round(width * worldScreens),
    tiles,
    s: tf.s,
    farPx: tf.y(far),
    nearPx: tf.y(NEAR_Y),
    base,
    kFar: home ? 0.84 : 0.66,
    margin: Math.round(base * 0.45),
    sceneX: tf.x,
  };
}

export const scaleAt = (g: Geo, fy: number) => g.kFar + (1 - g.kFar) * fy;
export const pxX = (g: Geo, fx: number) => g.margin + fx * (g.worldW - g.margin * 2);
export const pxY = (g: Geo, fy: number) => g.farPx + fy * (g.nearPx - g.farPx);
export const fracX = (g: Geo, px: number) => clamp01((px - g.margin) / Math.max(1, g.worldW - g.margin * 2));
export const fracY = (g: Geo, py: number) => clamp01((py - g.farPx) / Math.max(1, g.nearPx - g.farPx));
export const clamp01 = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0.5));

// ---------- Плитки земли ----------
// Середина мира — как на главной (вариант 1: вещи отодвинуты от швов), по бокам — свои вещи (2 — левее, 3 — правее).
// Соседние плитки зеркальны друг другу: земля на швах сходится, а вещи на боковых плитках другие — без двойников.
export function tileLayout(tiles: number): { mirror: boolean; variant: Variant }[] {
  const c = Math.floor(tiles / 2);
  return Array.from({ length: tiles }, (_, i) => {
    const d = i - c;
    const odd = Math.abs(d) % 2 === 1;
    const variant: Variant = d === 0 ? 1 : odd === d < 0 ? 2 : 3;
    return { mirror: odd, variant };
  });
}

// ---------- Препятствия: сквозь костёр, деревья, камни и домики не ходят ----------
// Эллипсы на земле в координатах сцены (одна плитка) — по вариантам плиток (см. locations.ts).
type Ellipse = { x: number; y: number; rx: number; ry: number };
type ByVariant = Partial<Record<Variant, Ellipse[]>>;
const e = (x: number, y: number, rx: number, ry: number): Ellipse => ({ x, y, rx, ry });
const CAVE = (v: Variant): Ellipse[] => [
  ...caveRocks(v).map(([x, y, r]) => e(x, y, r * 1.55, r * 0.7)),
  ...crystalsOf(v)
    .filter((c) => c.y > 700)
    .map((c) => e(c.x, c.y, 24 * c.s, 10)),
];
const OBSTACLES: Partial<Record<LocationId, ByVariant>> = {
  meadow: { 1: [e(330, 598, 26, 10), e(26, 606, 34, 12)], 2: [e(274, 598, 26, 10), e(160, 606, 34, 12)], 3: [e(110, 598, 26, 10), e(318, 606, 34, 12)] },
  forest: { 1: [e(96, 616, 40, 16), e(55, 664, 42, 12)], 2: [e(250, 636, 54, 14)], 3: [e(120, 652, 26, 9), e(312, 652, 38, 11)] },
  cave: { 1: CAVE(1), 2: CAVE(2), 3: CAVE(3) },
  beach: { 2: [e(90, 650, 18, 8)], 3: [e(110, 646, 40, 12)] },
  snow: { 1: [e(62, 622, 24, 9)], 2: [e(120, 642, 40, 10)], 3: [e(250, 648, 50, 14)] },
  moon: { 1: [e(46, 528, 28, 8)], 2: [e(210, 542, 40, 10)], 3: [e(120, 530, 18, 7)] },
  mountains: { 2: [e(240, 546, 54, 12)], 3: [e(150, 562, 24, 9)] },
  sakura: { 3: [e(240, 508, 44, 9)] },
  cafe: { 1: [e(294, 528, 92, 14)], 2: [e(120, 504, 70, 12), e(320, 504, 22, 8)], 3: [e(260, 504, 70, 12), e(70, 504, 22, 8)] },
};

// Точка (пиксели мира) вне препятствий: если попали внутрь — выталкиваем к краю
export function freeSpot(g: Geo, loc: LocationId, px: number, py: number): { px: number; py: number } {
  const byV = OBSTACLES[loc];
  if (!byV) return { px, py };
  const tf = sceneTransform(g.width, g.height);
  let x = px;
  let y = py;
  tileLayout(g.tiles).forEach(({ mirror, variant }, i) => {
    for (const o of byV[variant] ?? []) {
      const local = g.sceneX(o.x);
      const cx = i * g.width + (mirror ? g.width - local : local);
      const cy = tf.y(o.y);
      const rx = o.rx * g.s + g.base * 0.22;
      const ry = o.ry * g.s + 6;
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d = Math.hypot(dx, dy);
      if (d < 1) {
        const k = d < 0.01 ? 1 : 1 / d;
        x = cx + (d < 0.01 ? 1 : dx) * k * rx * 1.02;
        y = cy + (d < 0.01 ? 0 : dy) * k * ry * 1.02;
      }
    }
  });
  return { px: Math.min(g.worldW - g.margin, Math.max(g.margin, x)), py: Math.min(g.nearPx, Math.max(g.farPx, y)) };
}

// ---------- Ходок ----------
export type MoverState = { moving: boolean; run: boolean; dir: 1 | -1; to: { x: number; y: number } };

// Шаг по нажатию — мягкий разгон и торможение; джойстик — ровно (отрезки идут один за другим без рывков)
const EASE = Easing.bezier(0.3, 0, 0.25, 1);
const LINEAR = (t: number) => t;
export const RUN_SPEED = 160; // пикселей сцены в секунду
export const WALK_SPEED = 64;

export class Mover {
  x: Animated.Value;
  y: Animated.Value;
  private g: Geo;
  private from = { x: 0.5, y: 0.5 };
  private start = 0;
  private dur = 0;
  private anim: Animated.CompositeAnimation | null = null;
  private ease: (t: number) => number = LINEAR;
  private seq = 0;
  state: MoverState;
  private listeners = new Set<() => void>();

  constructor(g: Geo, fx: number, fy: number) {
    this.g = g;
    this.from = { x: clamp01(fx), y: clamp01(fy) };
    this.state = { moving: false, run: false, dir: 1, to: { ...this.from } };
    this.x = new Animated.Value(pxX(g, this.from.x));
    this.y = new Animated.Value(pxY(g, this.from.y));
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  getState = () => this.state;
  private set(p: Partial<MoverState>) {
    this.state = { ...this.state, ...p };
    this.listeners.forEach((l) => l());
  }

  // Где сейчас (доли) — с учётом того, что идёт
  now(): { x: number; y: number } {
    if (!this.state.moving || this.dur <= 0) return this.state.to;
    const k = this.ease(Math.min(1, (Date.now() - this.start) / this.dur));
    return { x: this.from.x + (this.state.to.x - this.from.x) * k, y: this.from.y + (this.state.to.y - this.from.y) * k };
  }

  // Новая геометрия (повернули экран, сменился размер мира): стоим на тех же долях
  setGeo(g: Geo) {
    this.g = g;
    this.snap(this.state.to.x, this.state.to.y);
  }

  snap(fx: number, fy: number) {
    this.anim?.stop();
    this.seq++;
    const to = { x: clamp01(fx), y: clamp01(fy) };
    this.from = to;
    this.x.setValue(pxX(this.g, to.x));
    this.y.setValue(pxY(this.g, to.y));
    this.set({ moving: false, to });
  }

  // Идёт (или бежит) в точку; onArrive — когда дошёл (не вызывается, если перебили новой командой).
  // smooth — мягкий разгон и торможение (нажатие на землю); без него — ровно (джойстик, чужие команды старых версий)
  go(fx: number, fy: number, run: boolean, onArrive?: () => void, reduce = false, smooth = false): number {
    const to = { x: clamp01(fx), y: clamp01(fy) };
    const cur = this.now();
    this.anim?.stop();
    const id = ++this.seq;
    const dx = pxX(this.g, to.x) - pxX(this.g, cur.x);
    const dy = (pxY(this.g, to.y) - pxY(this.g, cur.y)) * 1.4; // вглубь — чуть медленнее
    const dist = Math.hypot(dx, dy);
    const speed = (run ? RUN_SPEED : WALK_SPEED) * this.g.s;
    this.from = cur;
    if (reduce || dist < 2) {
      this.from = to;
      this.x.setValue(pxX(this.g, to.x));
      this.y.setValue(pxY(this.g, to.y));
      this.set({ moving: false, to, dir: Math.abs(dx) > 2 ? (dx > 0 ? 1 : -1) : this.state.dir });
      onArrive?.();
      return 0;
    }
    this.start = Date.now();
    this.ease = smooth ? EASE : LINEAR;
    // с разгоном путь чуть дольше — средняя скорость та же
    this.dur = Math.max(smooth ? 420 : 250, (dist / speed) * 1000 * (smooth ? 1.18 : 1));
    this.set({ moving: true, run, to, dir: Math.abs(dx) > 4 ? (dx > 0 ? 1 : -1) : this.state.dir });
    this.x.setValue(pxX(this.g, cur.x));
    this.y.setValue(pxY(this.g, cur.y));
    const t = (v: Animated.Value, toValue: number) =>
      Animated.timing(v, { toValue, duration: this.dur, easing: this.ease, useNativeDriver: nativeDriver });
    this.anim = Animated.parallel([t(this.x, pxX(this.g, to.x)), t(this.y, pxY(this.g, to.y))]);
    this.anim.start(({ finished }) => {
      if (!finished || id !== this.seq) return;
      this.from = to;
      this.set({ moving: false });
      onArrive?.();
    });
    return this.dur;
  }

  face(dir: 1 | -1) {
    if (dir !== this.state.dir) this.set({ dir });
  }

  // Остановиться там, где идёт сейчас
  stop() {
    const cur = this.now();
    this.anim?.stop();
    this.seq++;
    this.from = cur;
    this.x.setValue(pxX(this.g, cur.x));
    this.y.setValue(pxY(this.g, cur.y));
    this.set({ moving: false, to: cur });
  }
}

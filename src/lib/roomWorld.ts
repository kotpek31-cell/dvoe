// Площадка комнаты (и главной): мир шире экрана, земля с глубиной.
// Место чибика — доли: x — по ширине мира (0…1), y — по глубине земли (0 — дальний край, 1 — ближний).
// Пиксели считаем на каждом телефоне сами: доли одинаковые у всех, поэтому все видят одно и то же место.
// Mover — один ходок: двигает Animated-значения (ноги в точке мира) и сообщает, идёт ли он и куда смотрит.
import { Animated, Easing } from 'react-native';
import type { LocationId } from './locations';
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

// ---------- Препятствия: сквозь костёр, деревья и камни не ходят ----------
// Эллипсы на земле в координатах сцены (одна плитка); плитки через одну зеркальные.
type Ellipse = { x: number; y: number; rx: number; ry: number };
const OBSTACLES: Partial<Record<LocationId, Ellipse[]>> = {
  meadow: [
    { x: 346, y: 598, rx: 26, ry: 10 },
    { x: 26, y: 606, rx: 34, ry: 12 },
  ],
  forest: [
    { x: 96, y: 616, rx: 40, ry: 16 },
    { x: 55, y: 664, rx: 42, ry: 12 },
  ],
  cave: [
    { x: 120, y: 560, rx: 22, ry: 10 },
    { x: 260, y: 700, rx: 26, ry: 12 },
    { x: 380, y: 600, rx: 18, ry: 8 },
    { x: 60, y: 760, rx: 30, ry: 12 },
  ],
};

// Точка (пиксели мира) вне препятствий: если попали внутрь — выталкиваем к краю
export function freeSpot(g: Geo, loc: LocationId, px: number, py: number): { px: number; py: number } {
  const list = OBSTACLES[loc];
  if (!list) return { px, py };
  const tf = sceneTransform(g.width, g.height);
  let x = px;
  let y = py;
  for (let i = 0; i < g.tiles; i++) {
    const mirror = i % 2 === 1;
    for (const o of list) {
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
  }
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

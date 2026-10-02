// Стенд: упрощённая замена react-native для запуска компонентов в браузере без сборки Expo.
// Только то, что нужно для картинки и анимаций: View/Text/Pressable, StyleSheet, Animated, Easing.
// Это НЕ часть приложения — в сборку не попадает (см. tools/stand/README.md).
import React, { createElement, forwardRef, useEffect, useRef, useState } from 'react';

type AnyStyle = Record<string, unknown>;

// ---------- Animated: узлы ----------
class Node {
  get(): number | string {
    return 0;
  }
  interpolate(cfg: InterpCfg) {
    return new Interp(this, cfg);
  }
}
type InterpCfg = { inputRange: number[]; outputRange: (number | string)[]; extrapolate?: string; extrapolateLeft?: string; extrapolateRight?: string; easing?: (t: number) => number };

const split = (v: number | string): [number, string] => {
  if (typeof v === 'number') return [v, ''];
  const m = /^(-?[\d.]+(?:e-?\d+)?)(.*)$/.exec(v.trim());
  return m ? [parseFloat(m[1]), m[2]] : [0, ''];
};

class Interp extends Node {
  constructor(private parent: Node, private cfg: InterpCfg) {
    super();
  }
  get() {
    const x = Number(this.parent.get());
    const { inputRange: I, outputRange: O } = this.cfg;
    const left = this.cfg.extrapolateLeft ?? this.cfg.extrapolate ?? 'extend';
    const right = this.cfg.extrapolateRight ?? this.cfg.extrapolate ?? 'extend';
    let i = 1;
    while (i < I.length - 1 && x > I[i]) i += 1;
    const [a, b] = [I[i - 1], I[i]];
    const [oa, unit] = split(O[i - 1]);
    const [ob] = split(O[i]);
    let t = b === a ? (x >= b ? 1 : 0) : (x - a) / (b - a);
    if (x < I[0] && left === 'clamp') t = 0;
    if (x > I[I.length - 1] && right === 'clamp') t = 1;
    if (this.cfg.easing && t >= 0 && t <= 1) t = this.cfg.easing(t);
    const v = oa + (ob - oa) * t;
    return unit ? `${v}${unit}` : v;
  }
}

class Op extends Node {
  constructor(private a: Node | number, private b: Node | number, private fn: (a: number, b: number) => number) {
    super();
  }
  get() {
    const n = (v: Node | number) => (typeof v === 'number' ? v : Number(v.get()));
    return this.fn(n(this.a), n(this.b));
  }
}

type EndCb = (r: { finished: boolean }) => void;
type Anim = { start: (cb?: EndCb) => void; stop: () => void; reset: () => void; _value?: Value };

const active = new Set<{ tick: (now: number) => boolean }>();
const dirty = new Set<() => void>();
let raf = 0;
function loopFrame(now: number) {
  active.forEach((a) => {
    if (!a.tick(now)) active.delete(a);
  });
  dirty.forEach((fn) => fn());
  raf = active.size || dirty.size ? requestAnimationFrame(loopFrame) : 0;
}
const kick = () => {
  if (!raf && typeof requestAnimationFrame !== 'undefined') raf = requestAnimationFrame(loopFrame);
};

class Value extends Node {
  _v: number;
  _anim: { stop: () => void } | null = null;
  _listeners = new Map<string, (s: { value: number }) => void>();
  constructor(v: number) {
    super();
    this._v = v;
  }
  get() {
    return this._v;
  }
  _set(v: number) {
    this._v = v;
    this._listeners.forEach((l) => l({ value: v }));
  }
  setValue(v: number) {
    this._anim?.stop();
    this._set(v);
    kick();
  }
  stopAnimation(cb?: (v: number) => void) {
    this._anim?.stop();
    cb?.(this._v);
  }
  resetAnimation(cb?: (v: number) => void) {
    this.stopAnimation(cb);
  }
  addListener(fn: (s: { value: number }) => void) {
    const id = String(Math.random());
    this._listeners.set(id, fn);
    return id;
  }
  removeListener(id: string) {
    this._listeners.delete(id);
  }
  removeAllListeners() {
    this._listeners.clear();
  }
  setOffset() {}
  flattenOffset() {}
  extractOffset() {}
}

const E = {
  linear: (t: number) => t,
  ease: (t: number) => bezier(0.42, 0, 1, 1)(t),
  quad: (t: number) => t * t,
  cubic: (t: number) => t * t * t,
  poly: (n: number) => (t: number) => Math.pow(t, n),
  sin: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
  circle: (t: number) => 1 - Math.sqrt(1 - t * t),
  exp: (t: number) => Math.pow(2, 10 * (t - 1)),
  elastic: (b = 1) => (t: number) => 1 - Math.pow(Math.cos((t * Math.PI) / 2), 3) * Math.cos(t * b * Math.PI),
  back: (s = 1.70158) => (t: number) => t * t * ((s + 1) * t - s),
  bounce: (t: number) => {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
  },
  bezier,
  in: (f: (t: number) => number) => f,
  out: (f: (t: number) => number) => (t: number) => 1 - f(1 - t),
  inOut: (f: (t: number) => number) => (t: number) => (t < 0.5 ? f(t * 2) / 2 : 1 - f((1 - t) * 2) / 2),
  step0: (t: number) => (t > 0 ? 1 : 0),
  step1: (t: number) => (t >= 1 ? 1 : 0),
};
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const fx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const fy = (t: number) => ((ay * t + by) * t + cy) * t;
  return (x: number) => {
    let t = x;
    for (let i = 0; i < 6; i += 1) {
      const d = (3 * ax * t + 2 * bx) * t + cx;
      if (Math.abs(d) < 1e-6) break;
      t -= (fx(t) - x) / d;
    }
    return fy(Math.min(1, Math.max(0, t)));
  };
}
export const Easing = E;

function timing(value: Value, cfg: { toValue: number | Node; duration?: number; easing?: (t: number) => number; delay?: number }): Anim {
  let entry: { tick: (now: number) => boolean } | null = null;
  let done: EndCb | undefined;
  let initial: number | null = null;
  const stop = () => {
    if (!entry) return;
    active.delete(entry);
    entry = null;
    if (value._anim === handle) value._anim = null;
    const cb = done;
    done = undefined;
    cb?.({ finished: false });
  };
  const handle = { stop };
  return {
    _value: value,
    start(cb) {
      value._anim?.stop();
      done = cb;
      const from = value._v;
      if (initial === null) initial = from;
      const dur = cfg.duration ?? 500;
      const ease = cfg.easing ?? E.inOut(E.ease);
      const t0 = performance.now() + (cfg.delay ?? 0);
      const to = () => (typeof cfg.toValue === 'number' ? cfg.toValue : Number(cfg.toValue.get()));
      entry = {
        tick(now) {
          const k = dur <= 0 ? 1 : Math.min(1, Math.max(0, (now - t0) / dur));
          value._set(from + (to() - from) * ease(k));
          if (k < 1) return true;
          entry = null;
          if (value._anim === handle) value._anim = null;
          const c = done;
          done = undefined;
          c?.({ finished: true });
          return false;
        },
      };
      value._anim = handle;
      active.add(entry);
      kick();
    },
    stop,
    reset() {
      stop();
      if (initial !== null) value._set(initial);
    },
  };
}

function spring(value: Value, cfg: { toValue: number; speed?: number; bounciness?: number; friction?: number; tension?: number; damping?: number; stiffness?: number; mass?: number }): Anim {
  let entry: { tick: (now: number) => boolean } | null = null;
  let done: EndCb | undefined;
  let initial: number | null = null;
  const stop = () => {
    if (!entry) return;
    active.delete(entry);
    entry = null;
    if (value._anim === handle) value._anim = null;
    const cb = done;
    done = undefined;
    cb?.({ finished: false });
  };
  const handle = { stop };
  const k = cfg.stiffness ?? (cfg.tension ? cfg.tension * 1.2 : cfg.speed ? 60 + cfg.speed * 14 : 170);
  const c = cfg.damping ?? (cfg.friction ? cfg.friction * 2.2 : cfg.bounciness !== undefined ? Math.max(8, 30 - cfg.bounciness * 1.6) : 18);
  return {
    _value: value,
    start(cb) {
      value._anim?.stop();
      done = cb;
      if (initial === null) initial = value._v;
      let vel = 0;
      let last = performance.now();
      entry = {
        tick(now) {
          let dt = Math.min(0.05, (now - last) / 1000);
          last = now;
          while (dt > 0) {
            const h = Math.min(dt, 0.004);
            vel += (-k * (value._v - cfg.toValue) - c * vel) * h;
            value._v += vel * h;
            dt -= h;
          }
          value._set(value._v);
          if (Math.abs(vel) > 0.01 || Math.abs(value._v - cfg.toValue) > 0.001) return true;
          value._set(cfg.toValue);
          entry = null;
          if (value._anim === handle) value._anim = null;
          const d = done;
          done = undefined;
          d?.({ finished: true });
          return false;
        },
      };
      value._anim = handle;
      active.add(entry);
      kick();
    },
    stop,
    reset() {
      stop();
      if (initial !== null) value._set(initial);
    },
  };
}

function sequence(list: Anim[]): Anim {
  let i = -1;
  let stopped = false;
  return {
    start(cb) {
      stopped = false;
      i = -1;
      const next = () => {
        i += 1;
        if (i >= list.length) return cb?.({ finished: true });
        list[i].start((r) => {
          if (!r.finished || stopped) return cb?.({ finished: false });
          next();
        });
      };
      next();
    },
    stop() {
      stopped = true;
      if (i >= 0 && i < list.length) list[i].stop();
    },
    reset() {
      stopped = true;
      for (let j = list.length - 1; j >= 0; j -= 1) list[j].reset();
    },
  };
}

function parallel(list: Anim[], opts: { stopTogether?: boolean } = {}): Anim {
  return {
    start(cb) {
      let left = list.length;
      let ok = true;
      if (!left) return cb?.({ finished: true });
      list.forEach((a) =>
        a.start((r) => {
          left -= 1;
          if (!r.finished) {
            ok = false;
            if (opts.stopTogether !== false) list.forEach((x) => x !== a && x.stop());
          }
          if (left === 0) cb?.({ finished: ok });
        }),
      );
    },
    stop() {
      list.forEach((a) => a.stop());
    },
    reset() {
      list.forEach((a) => a.reset());
    },
  };
}

const delay = (ms: number): Anim => timing(new Value(0), { toValue: 1, duration: ms, easing: E.linear });
const stagger = (ms: number, list: Anim[]): Anim => parallel(list.map((a, i) => sequence([delay(ms * i), a])));

function loop(anim: Anim, opts: { iterations?: number } = {}): Anim {
  let stopped = false;
  let n = 0;
  return {
    start(cb) {
      stopped = false;
      n = 0;
      const run = () => {
        anim.reset();
        anim.start((r) => {
          if (!r.finished || stopped) return cb?.({ finished: false });
          n += 1;
          if (opts.iterations && opts.iterations > 0 && n >= opts.iterations) return cb?.({ finished: true });
          run();
        });
      };
      run();
    },
    stop() {
      stopped = true;
      anim.stop();
    },
    reset() {
      stopped = true;
      anim.reset();
    },
  };
}

// ---------- стили ----------
const UNITLESS = new Set(['opacity', 'flex', 'flexGrow', 'flexShrink', 'zIndex', 'fontWeight', 'aspectRatio', 'scale', 'scaleX', 'scaleY', 'order']);
const isNode = (v: unknown): v is Node => v instanceof Node;

function flatten(style: unknown, out: AnyStyle = {}): AnyStyle {
  if (!style) return out;
  if (Array.isArray(style)) style.forEach((s) => flatten(s, out));
  else if (typeof style === 'object') Object.assign(out, style as AnyStyle);
  return out;
}

function hasNodes(flat: AnyStyle): boolean {
  return Object.values(flat).some((v) => isNode(v) || (Array.isArray(v) && v.some((t) => t && typeof t === 'object' && Object.values(t as AnyStyle).some(isNode))));
}

const px = (v: unknown) => (typeof v === 'number' ? `${v}px` : (v as string));
const val = (v: unknown) => (isNode(v) ? v.get() : v);

function transformCss(list: unknown): string {
  if (!Array.isArray(list)) return typeof list === 'string' ? list : '';
  return list
    .map((t) => {
      if (!t || typeof t !== 'object') return '';
      const [k, raw] = Object.entries(t as AnyStyle)[0];
      const v = val(raw);
      if (k === 'translateX' || k === 'translateY') return `${k}(${px(v)})`;
      if (k === 'translate' && Array.isArray(v)) return `translate(${px(val(v[0]))}, ${px(val(v[1]))})`;
      if (k.startsWith('rotate') || k.startsWith('skew')) return `${k}(${typeof v === 'number' ? `${v}rad` : v})`;
      if (k === 'perspective') return `perspective(${px(v)})`;
      return `${k}(${v})`;
    })
    .join(' ');
}

export function toCss(flat: AnyStyle): Record<string, string | number> {
  const o: Record<string, string | number> = {};
  for (const [k, raw] of Object.entries(flat)) {
    const v = val(raw);
    if (v === undefined || v === null) continue;
    if (k === 'transform') o.transform = transformCss(raw);
    else if (k === 'paddingVertical') (o.paddingTop = px(v)), (o.paddingBottom = px(v));
    else if (k === 'paddingHorizontal') (o.paddingLeft = px(v)), (o.paddingRight = px(v));
    else if (k === 'marginVertical') (o.marginTop = px(v)), (o.marginBottom = px(v));
    else if (k === 'marginHorizontal') (o.marginLeft = px(v)), (o.marginRight = px(v));
    else if (k === 'shadowColor' || k === 'shadowOffset' || k === 'shadowOpacity' || k === 'shadowRadius' || k === 'elevation') continue;
    else if (k === 'textShadowOffset') continue;
    else if (k === 'textShadowRadius') o.textShadow = `0 0 ${px(v)} ${String(flat.textShadowColor ?? '#000')}`;
    else if (k === 'textShadowColor') continue;
    else if (k === 'borderWidth') (o.borderWidth = px(v)), (o.borderStyle = 'solid');
    else if (/^border(Top|Bottom|Left|Right)Width$/.test(k)) (o[k] = px(v)), (o.borderStyle = 'solid');
    else if (k === 'fontFamily') o.fontFamily = `${fontOf(String(v))}`;
    else if (k === 'lineHeight' || k === 'letterSpacing' || k === 'fontSize') o[k] = px(v);
    else if (k === 'flex' && typeof v === 'number') (o.flexGrow = v), (o.flexShrink = 1), (o.flexBasis = '0%');
    else if (k === 'pointerEvents') o.pointerEvents = v === 'box-none' ? 'none' : String(v);
    else if (k === 'textAlignVertical' || k === 'includeFontPadding' || k === 'userSelect') continue;
    else o[k] = typeof v === 'number' && !UNITLESS.has(k) ? `${v}px` : (v as string | number);
  }
  return o;
}

// Шрифты приложения → веб-шрифты стенда (Nunito и Unbounded с Google Fonts, если доступны)
function fontOf(name: string): string {
  if (name.startsWith('Unbounded')) return `'Unbounded', 'Arial Black', system-ui, sans-serif`;
  if (name.startsWith('Nunito')) return `'Nunito', system-ui, sans-serif`;
  return name;
}
function fontWeightOf(name: unknown): number | undefined {
  const m = /_(\d{3})/.exec(String(name ?? ''));
  return m ? Number(m[1]) : undefined;
}

const BASE: Record<string, string | number> = {
  display: 'flex', flexDirection: 'column', position: 'relative', boxSizing: 'border-box', minWidth: 0, minHeight: 0, flexShrink: 0,
  margin: 0, padding: 0, borderWidth: 0, borderStyle: 'solid', borderColor: 'black', alignItems: 'stretch',
};
const TEXT_BASE: Record<string, string | number> = { ...BASE, display: 'inline', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#000', fontSize: '14px', fontFamily: 'system-ui, sans-serif' };

type Props = Record<string, unknown> & { style?: unknown; children?: React.ReactNode; pointerEvents?: string };

function domProps(p: Props, base: Record<string, string | number>) {
  const flat = flatten(typeof p.style === 'function' ? (p.style as (s: { pressed: boolean }) => unknown)({ pressed: false }) : p.style);
  const css = { ...base, ...toCss(flat) };
  const w = fontWeightOf(flat.fontFamily);
  if (w) css.fontWeight = w;
  if (p.pointerEvents) css.pointerEvents = p.pointerEvents === 'box-none' ? 'none' : String(p.pointerEvents);
  const out: Record<string, unknown> = { style: css };
  if (p.accessibilityLabel) out['aria-label'] = p.accessibilityLabel;
  if (p.testID) out['data-testid'] = p.testID;
  return { out, flat };
}

function make(tag: string, base: Record<string, string | number>, animated: boolean) {
  return forwardRef<HTMLElement, Props>(function Comp(p, ref) {
    const el = useRef<HTMLElement | null>(null);
    const { out, flat } = domProps(p, base);
    const live = animated && hasNodes(flat);
    const latest = useRef(flat);
    latest.current = flat;
    useEffect(() => {
      if (!live) return;
      const apply = () => {
        const node = el.current;
        if (!node) return;
        const css = toCss(latest.current);
        if (css.transform !== undefined) node.style.transform = String(css.transform);
        if (css.opacity !== undefined) node.style.opacity = String(css.opacity);
        for (const k of ['left', 'top', 'width', 'height', 'right', 'bottom'] as const) if (isNode(latest.current[k])) node.style[k] = String(css[k]);
      };
      dirty.add(apply);
      kick();
      return () => {
        dirty.delete(apply);
      };
    }, [live]);
    const on = p.onPress || p.onLongPress ? { onClick: (e: React.MouseEvent) => (p.onPress as ((e: unknown) => void) | undefined)?.({ nativeEvent: { pageX: e.pageX, pageY: e.pageY, locationX: e.nativeEvent.offsetX, locationY: e.nativeEvent.offsetY } }) } : {};
    if (p.onPress || p.onLongPress) (out.style as Record<string, unknown>).cursor = 'pointer';
    const children = tag === 'span' && p.numberOfLines === 1 ? p.children : p.children;
    return createElement(tag, { ...out, ...on, ref: (n: HTMLElement | null) => { el.current = n; if (typeof ref === 'function') ref(n); else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = n; } }, children as React.ReactNode);
  });
}

export const View = make('div', BASE, false);
export const Text = make('span', TEXT_BASE, false);
export const Pressable = make('div', BASE, false);
export const TouchableOpacity = Pressable;
export const ScrollView = make('div', { ...BASE, overflow: 'auto' }, false);
export const SafeAreaView = View;
export const KeyboardAvoidingView = View;
export const Image = (p: Props & { source?: { uri?: string } | number }) => createElement('img', { src: typeof p.source === 'object' ? p.source?.uri : undefined, style: { ...toCss(flatten(p.style)) } });
export const TextInput = (p: Props) => createElement('input', { style: { ...toCss(flatten(p.style)) }, defaultValue: p.value as string });
export const ActivityIndicator = () => createElement('span', null, '…');
export const Modal = (p: Props & { visible?: boolean }) => (p.visible ? createElement('div', { style: { position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column' } }, p.children) : null);
export const Switch = () => null;
export const RefreshControl = () => null;
export const FlatList = (p: Props & { data?: unknown[]; renderItem?: (x: { item: unknown; index: number }) => React.ReactNode }) => createElement('div', null, (p.data ?? []).map((item, index) => p.renderItem?.({ item, index })));

const abs = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as const;
export const StyleSheet = {
  create: <T,>(s: T): T => s,
  absoluteFill: abs,
  absoluteFillObject: abs,
  flatten: (s: unknown) => flatten(s),
  hairlineWidth: 1,
  compose: (a: unknown, b: unknown) => [a, b],
};

export const Animated = {
  Value,
  ValueXY: class {
    x = new Value(0);
    y = new Value(0);
  },
  View: make('div', BASE, true),
  Text: make('span', TEXT_BASE, true),
  ScrollView: make('div', { ...BASE, overflow: 'auto' }, true),
  Image,
  createAnimatedComponent: <T,>(c: T) => c,
  timing,
  spring,
  decay: (v: Value) => timing(v, { toValue: v._v, duration: 1 }),
  sequence,
  parallel,
  stagger,
  delay,
  loop,
  add: (a: Node | number, b: Node | number) => new Op(a, b, (x, y) => x + y),
  subtract: (a: Node | number, b: Node | number) => new Op(a, b, (x, y) => x - y),
  multiply: (a: Node | number, b: Node | number) => new Op(a, b, (x, y) => x * y),
  divide: (a: Node | number, b: Node | number) => new Op(a, b, (x, y) => x / y),
  modulo: (a: Node, m: number) => new Op(a, m, (x, y) => ((x % y) + y) % y),
  diffClamp: (a: Node, lo: number, hi: number) => new Op(a, 0, (x) => Math.min(hi, Math.max(lo, x))),
  event: () => () => undefined,
};
// типы, которыми пользуется приложение
// eslint-disable-next-line @typescript-eslint/no-namespace, @typescript-eslint/no-redeclare
export declare namespace Animated {
  type Value = InstanceType<typeof Value>;
  type AnimatedInterpolation<T> = Interp & { __t?: T };
  type AnimatedAddition<T> = Op & { __t?: T };
  type CompositeAnimation = Anim;
}

export const Platform = { OS: 'web' as string, select: <T,>(o: { web?: T; default?: T; android?: T; ios?: T }) => o.web ?? o.default, Version: 0 };
const win = () => ({ width: typeof window === 'undefined' ? 390 : window.innerWidth, height: typeof window === 'undefined' ? 844 : window.innerHeight, scale: 2, fontScale: 1 });
export const Dimensions = { get: () => win(), addEventListener: () => ({ remove() {} }) };
export function useWindowDimensions() {
  const [d, setD] = useState(win);
  useEffect(() => {
    const on = () => setD(win());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return d;
}
const reduced = () => typeof window !== 'undefined' && /[?&]reduce=1/.test(window.location.search);
export const AccessibilityInfo = {
  isReduceMotionEnabled: () => Promise.resolve(reduced()),
  isScreenReaderEnabled: () => Promise.resolve(false),
  addEventListener: () => ({ remove() {} }),
  announceForAccessibility: () => undefined,
};
export const PixelRatio = { get: () => 2, roundToNearestPixel: (n: number) => Math.round(n * 2) / 2, getFontScale: () => 1 };
export const Share = { share: () => Promise.resolve({ action: 'dismissed' }) };
export const Linking = { openURL: () => Promise.resolve(), canOpenURL: () => Promise.resolve(true), addEventListener: () => ({ remove() {} }), getInitialURL: () => Promise.resolve(null) };
export const Alert = { alert: () => undefined };
export const Keyboard = { dismiss: () => undefined, addListener: () => ({ remove() {} }) };
export const AppState = { currentState: 'active', addEventListener: () => ({ remove() {} }) };
export const Vibration = { vibrate: () => undefined };
export const I18nManager = { isRTL: false };
export const LayoutAnimation = { configureNext: () => undefined, Presets: {} };
export const PanResponder = { create: () => ({ panHandlers: {} }) };
export const NativeModules = {};
export const useColorScheme = () => 'dark';
export const Appearance = { getColorScheme: () => 'dark', addChangeListener: () => ({ remove() {} }) };
export default { View, Text, StyleSheet, Animated, Easing, Platform };

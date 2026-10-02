// Стенд: react-native-svg → обычный SVG в браузере. Не часть приложения.
import { createElement, type ReactNode } from 'react';
import { StyleSheet, toCss } from 'react-native';

type P = Record<string, unknown> & { children?: ReactNode };

const tag = (name: string) =>
  function SvgEl({ children, ...rest }: P) {
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v === undefined || v === null) continue;
      if (k === 'style') props.style = toCss(StyleSheet.flatten(v));
      else if (k === 'pointerEvents') props.pointerEvents = v;
      else props[k] = v;
    }
    return createElement(name, props, children);
  };

function Svg({ children, style, pointerEvents, ...rest }: P) {
  const css = { display: 'block', overflow: 'hidden', flexShrink: 0, ...toCss(StyleSheet.flatten(style)) } as Record<string, unknown>;
  if (pointerEvents) css.pointerEvents = pointerEvents;
  return createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', ...rest, style: css }, children);
}

export default Svg;
export { Svg };
export const G = tag('g');
export const Path = tag('path');
export const Circle = tag('circle');
export const Ellipse = tag('ellipse');
export const Rect = tag('rect');
export const Line = tag('line');
export const Polygon = tag('polygon');
export const Polyline = tag('polyline');
export const Defs = tag('defs');
export const LinearGradient = tag('linearGradient');
export const RadialGradient = tag('radialGradient');
export const Stop = tag('stop');
export const ClipPath = tag('clipPath');
export const Mask = tag('mask');
export const Image = tag('image');
export const Text = tag('text');
export const TSpan = tag('tspan');
export const Use = tag('use');
export const Symbol = tag('symbol');
export const Pattern = tag('pattern');
export const SvgXml = ({ xml, width, height }: { xml: string; width?: number; height?: number }) =>
  createElement('div', { style: { width, height }, dangerouslySetInnerHTML: { __html: xml } });

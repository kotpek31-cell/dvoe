// Рисунки мини-игр: тыква с фитилём, звёзды, тучка с молнией, руки «Камень, ножницы, бумага», сажа.
// Обводка — как у чибиков (#2B2035), мягкие заливки.
import { memo } from 'react';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import type { Hand } from '../../../lib/games/rules';

const INK = '#2B2035';

export const Pumpkin = memo(function Pumpkin({ size, glow = true }: { size: number; glow?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="-26 -30 56 56">
      {glow ? <Circle cx={0} cy={0} r={22} fill="#FFB347" opacity={0.3} /> : null}
      <Path d="M-13 1 C-15 -10 -7 -14 0 -13 C7 -14 15 -10 13 1 C15 11 7 15 0 14 C-7 15 -15 11 -13 1 Z" fill="#FF9A3D" stroke={INK} strokeWidth={1.8} />
      <Path d="M-6 -12 C-8.5 -4 -8.5 5 -6 13 M6 -12 C8.5 -4 8.5 5 6 13" stroke="#D9772A" strokeWidth={1.4} fill="none" strokeLinecap="round" />
      {/* глазки и улыбка — тыква нервничает */}
      <Path d="M-6.5 -1.5 l2.5 -3 l2.5 3 Z M1.5 -1.5 l2.5 -3 l2.5 3 Z" fill={INK} />
      <Path d="M-5 5 C-2 7.5 2 7.5 5 5" stroke={INK} strokeWidth={1.5} fill="none" strokeLinecap="round" />
      <Path d="M-1.8 -13 L-1.2 -17 L1.4 -17 L1.8 -13 Z" fill="#4E8A3E" stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
      <Path d="M1 -17 C4 -21 8 -20 9 -24" stroke="#8A5A44" strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </Svg>
  );
});

// Искра на фитиле (рисуется поверх тыквы и мерцает)
export const Spark = memo(function Spark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="-12 -12 24 24">
      <Circle cx={0} cy={0} r={7} fill="#FFD45E" opacity={0.45} />
      <Path d="M0 -9 L2 -2 L9 0 L2 2 L0 9 L-2 2 L-9 0 L-2 -2 Z" fill="#FFF4C2" stroke="#FFB800" strokeWidth={1} strokeLinejoin="round" />
    </Svg>
  );
});

const starPath = (() => {
  const pts: string[] = [];
  for (let k = 0; k < 10; k++) {
    const a = ((-90 + k * 36) * Math.PI) / 180;
    const r = k % 2 ? 4.7 : 10.5;
    pts.push(`${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
})();

export const StarArt = memo(function StarArt({ size, gold }: { size: number; gold?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="-14 -14 28 28">
      <Circle cx={0} cy={0} r={12} fill={gold ? '#FFB800' : '#FFE38A'} opacity={0.28} />
      <Path d={starPath} fill={gold ? '#FFB800' : '#FFD45E'} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M-2.5 -3.5 L-0.5 -6.5" stroke="#FFFFFF" strokeWidth={1.4} strokeLinecap="round" opacity={0.8} />
    </Svg>
  );
});

export const CloudArt = memo(function CloudArt({ size, bolt }: { size: number; bolt: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="-38 -24 76 62">
      {bolt ? <Path d="M-2 8 L-9 22 L-1 22 L-7 36 L9 17 L1 17 L6 8 Z" fill="#FFD45E" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" /> : null}
      <Path
        d="M-26 8 C-34 8 -36 -2 -28 -5 C-28 -15 -14 -18 -8 -11 C-4 -20 12 -21 16 -11 C24 -15 34 -8 30 2 C34 6 30 10 24 10 Z"
        fill="#6E6890"
        stroke={INK}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Path d="M-14 0 l3 3 M-11 0 l-3 3 M4 0 l3 3 M7 0 l-3 3" stroke={INK} strokeWidth={1.3} strokeLinecap="round" />
    </Svg>
  );
});

// Тень места падения: пунктирный овал
export const Shadow = memo(function Shadow({ w, color }: { w: number; color: string }) {
  return (
    <Svg width={w} height={w * 0.4} viewBox="-22 -9 44 18">
      <Ellipse cx={0} cy={0} rx={20} ry={7.2} fill={color} opacity={0.3} stroke={color} strokeWidth={1.3} strokeDasharray="3 4" />
    </Svg>
  );
});

const HAND_PATH: Record<Hand, { d: string; lines?: string }> = {
  rock: {
    d: 'M-11 2 C-12 -6 -6 -11 0 -11 C7 -11 12 -6 11 2 C11 9 6 12 0 12 C-7 12 -11 8 -11 2 Z',
    lines: 'M-6 -4 C-6 0 -6 2 -5 4 M0 -5 V3 M6 -4 C6 0 6 2 5 4',
  },
  paper: {
    d: 'M-10 12 V-4 C-10 -6 -7 -6 -7 -4 V-12 C-7 -14 -4 -14 -4 -12 V-14 C-4 -16 -1 -16 -1 -14 V-12 C-1 -14 2 -14 2 -12 V-10 C2 -12 5 -12 5 -10 V2 L8 -2 C9 -4 12 -2 11 0 L5 10 C4 12 2 12 0 12 Z',
  },
  scissors: {
    d: 'M-8 12 C-10 6 -9 2 -6 -1 L-9 -13 C-9.6 -15.6 -6 -16.4 -5.2 -14 L-2 -4 L2 -15 C3 -17.4 6.4 -16.4 5.8 -14 L3 -1 C7 1 8 6 6 12 Z',
  },
};

export const HAND_NAME: Record<Hand, string> = { rock: 'Камень', scissors: 'Ножницы', paper: 'Бумага' };

export const HandArt = memo(function HandArt({ hand, size, bubble = true }: { hand: Hand; size: number; bubble?: boolean }) {
  const p = HAND_PATH[hand];
  return (
    <Svg width={size} height={size} viewBox="-28 -28 56 56">
      {bubble ? <Circle cx={0} cy={0} r={26} fill="#FFFFFF" stroke={INK} strokeWidth={2} /> : null}
      <G transform="scale(1.3)">
        <Path d={p.d} fill="#FFDCC4" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
        {p.lines ? <Path d={p.lines} stroke={INK} strokeWidth={1.3} fill="none" strokeLinecap="round" /> : null}
      </G>
    </Svg>
  );
});

// Сажа на чибике после взрыва: пятна на лице и дымок над головой (рамка чибика 120×170)
export const Soot = memo(function Soot({ size }: { size: number }) {
  return (
    <Svg width={size} height={(size * 170) / 120} viewBox="0 0 120 170">
      <Ellipse cx={42} cy={66} rx={9} ry={6} fill={INK} opacity={0.42} />
      <Ellipse cx={78} cy={58} rx={7} ry={5} fill={INK} opacity={0.38} />
      <Ellipse cx={62} cy={82} rx={6} ry={4} fill={INK} opacity={0.34} />
      <Ellipse cx={30} cy={40} rx={8} ry={5} fill={INK} opacity={0.3} />
      <Path d="M52 10 C46 2 56 -4 52 -12 M70 12 C76 4 66 -2 72 -10" stroke="#9B93AE" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.7} />
    </Svg>
  );
});

// Оглушён тучкой: звёздочки вокруг головы
export const Dizzy = memo(function Dizzy({ size }: { size: number }) {
  return (
    <Svg width={size} height={size * 0.45} viewBox="-30 -12 60 24">
      <Ellipse cx={0} cy={0} rx={24} ry={7} fill="none" stroke="#FFD45E" strokeWidth={1.4} strokeDasharray="4 4" />
      <Path d={starPath} fill="#FFD45E" stroke={INK} strokeWidth={1.2} transform="translate(-20 1) scale(0.55)" />
      <Path d={starPath} fill="#FFD45E" stroke={INK} strokeWidth={1.2} transform="translate(18 -2) scale(0.5)" />
    </Svg>
  );
});

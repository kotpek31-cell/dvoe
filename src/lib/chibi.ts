// Три стандартных чибика 0.1: мальчик, девочка и небинарный.
// Рисунок в координатах 120×170 и собран из слоёв — в будущем сюда добавятся
// причёски, глаза, рост и остальная кастомизация (хранится в profiles.chibi, JSON).
import type { ChibiKind } from '../types';

export type ChibiDef = {
  hair: string;
  skin: string;
  top: string;
  legs: string;
  shoes: string;
  body: string;
  back: string;
  front: string;
  extra: string;
  sideL: string;
  sideR: string;
  shine: string;
  hoodie: boolean;
  dress: boolean;
  bow: boolean;
};

const HOODIE_BODY =
  'M40 104 C40 99 47 96 60 96 C73 96 80 99 80 104 L84 128 C85 134 81 137 76 137 L44 137 C39 137 35 134 36 128 Z';

export const CHIBI: Record<ChibiKind, ChibiDef> = {
  boy: {
    hair: '#2E2438',
    skin: '#FFDCC4',
    top: '#7F8CFF',
    legs: '#3B3F5C',
    shoes: '#F7F4FF',
    body: HOODIE_BODY,
    back: '',
    front:
      'M15 66 C11 38 30 17 60 17 C90 17 109 38 105 66 C102 58 98 52 93 49 C92 54 89 57 85 58 C85 52 82 47 77 45 C75 51 70 55 63 55 C65 50 64 46 61 43 C57 50 50 55 41 55 C44 51 45 47 44 44 C38 48 34 54 31 58 C30 53 28 50 26 49 C21 53 17 59 15 66 Z',
    extra: 'M59 18 C56 10 62 3 71 4 C66 7 64 11 65 18 Z',
    sideL: '',
    sideR: '',
    shine: 'M33 31 C40 24 50 21 58 21',
    hoodie: true,
    dress: false,
    bow: false,
  },
  girl: {
    hair: '#7A4A33',
    skin: '#FFDCC4',
    top: '#FF8FB3',
    legs: '#FFDCC4',
    shoes: '#6B3A5A',
    body: 'M41 103 C41 98.5 48 96 60 96 C72 96 79 98.5 79 103 L86 133 C87 138 83 140 78 140 L42 140 C37 140 33 138 34 133 Z',
    back:
      'M14 68 C10 36 32 16 60 16 C88 16 110 36 106 68 C106 84 108 100 112 116 C114 125 109 132 101 132 C95 132 91 128 89 122 L31 122 C29 128 25 132 19 132 C11 132 6 125 8 116 C12 100 14 84 14 68 Z',
    front:
      'M15 70 C11 38 32 16 60 16 C88 16 109 38 105 70 C103 63 101 58 98 54 C94 58 89 58 85 55 C82 59 76 60 71 57 C67 61 62 61 58 58 C54 61 48 61 45 57 C41 60 36 59 32 55 C28 58 23 58 21 54 C18 59 16 64 15 70 Z',
    extra: '',
    sideL: 'M16 62 C12 78 12 96 17 112 C21 108 23 98 24 88 C25 78 24 70 23 60 Z',
    sideR: 'M104 62 C108 78 108 96 103 112 C99 108 97 98 96 88 C95 78 96 70 97 60 Z',
    shine: 'M31 31 C39 23 50 20 60 20 M72 21 C79 22 85 25 89 30',
    hoodie: false,
    dress: true,
    bow: true,
  },
  nb: {
    hair: '#5B4A6E',
    skin: '#FFDCC4',
    top: '#5ED3A0',
    legs: '#3B3F5C',
    shoes: '#F7F4FF',
    body: HOODIE_BODY,
    back: 'M14 68 C10 36 32 16 60 16 C88 16 110 36 106 68 C107 80 106 90 101 97 L19 97 C14 90 13 80 14 68 Z',
    front:
      'M15 70 C11 38 32 16 60 16 C88 16 109 38 105 70 C103 62 100 55 95 50 C88 55 76 54 68 44 C66 50 62 53 60 53 C58 53 54 50 52 44 C44 54 32 55 25 50 C20 55 17 62 15 70 Z',
    extra: '',
    sideL: 'M16 62 C12 74 13 86 18 96 C20 92 23 90 26 90 C24 82 23 72 23 62 Z',
    sideR: 'M104 62 C108 74 107 86 102 96 C100 92 97 90 94 90 C96 82 97 72 97 62 Z',
    shine: 'M31 31 C39 23 50 20 60 20',
    hoodie: true,
    dress: false,
    bow: false,
  },
};

export const CHIBI_LABELS: Record<ChibiKind, string> = {
  boy: 'Мальчик',
  girl: 'Девочка',
  nb: 'Небинарный',
};

export const CHIBI_KINDS: ChibiKind[] = ['boy', 'girl', 'nb'];

export function chibiKindOf(profile: { chibi?: { kind?: unknown } | null } | null | undefined): ChibiKind {
  const kind = profile?.chibi?.kind;
  return kind === 'boy' || kind === 'girl' || kind === 'nb' ? kind : 'nb';
}

export function hasChosenChibi(profile: { chibi?: { kind?: unknown } | null } | null | undefined): boolean {
  const kind = profile?.chibi?.kind;
  return kind === 'boy' || kind === 'girl' || kind === 'nb';
}

// Постоянные детали рисунка
export const CHIBI_PARTS = {
  shadow: { cx: 60, cy: 163, rx: 27, ry: 4.5 },
  legL: { x: 47, y: 124, w: 11, h: 24 },
  legR: { x: 62, y: 124, w: 11, h: 24 },
  shoeL: 'M44 150 C44 145 47.5 143.5 52.5 143.5 C57.5 143.5 60 146 60 150.5 C60 154.5 57 156.5 52 156.5 C47 156.5 44 154.5 44 150 Z',
  shoeR: 'M76 150 C76 145 72.5 143.5 67.5 143.5 C62.5 143.5 60 146 60 150.5 C60 154.5 63 156.5 68 156.5 C73 156.5 76 154.5 76 150 Z',
  pocket: 'M47 123 C52 119 68 119 73 123 L72 132 L48 132 Z',
  strings: 'M55 102 L54.5 111 M65 102 L65.5 111',
  hem: 'M35 132.5 C47 135.5 73 135.5 85 132.5',
  collar: 'M47 99.5 C49 106 56 107 60 102 C64 107 71 106 73 99.5 C68 98 52 98 47 99.5 Z',
  blanket: 'M10 102 C10 97 22 95 60 95 C98 95 110 97 110 102 L113 154 C113 163 107 167 99 167 L21 167 C13 167 7 163 7 154 Z',
  blanketFold: 'M10 102 C10 97 22 95 60 95 C98 95 110 97 110 102 L110.5 113 C98 109.5 22 109.5 9.5 113 Z',
  blanketMarks: 'M30 128 l3 3 l3 -3 M60 140 l3 3 l3 -3 M84 124 l3 3 l3 -3 M44 152 l3 3 l3 -3 M88 150 l3 3 l3 -3',
  bowLoops: 'M0 0 C-4 -7 -12 -8 -12 -1 C-12 6 -4 5 0 0 Z M0 0 C4 -7 12 -8 12 -1 C12 6 4 5 0 0 Z',
  // точки вращения рук: плечи
  shoulderL: { x: 39, y: 103 },
  shoulderR: { x: 81, y: 103 },
} as const;

export function darken(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number, target: number) => Math.round(c + (target - c) * t);
  const r = mix((n >> 16) & 255, 0x2b);
  const g = mix((n >> 8) & 255, 0x20);
  const b = mix(n & 255, 0x35);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

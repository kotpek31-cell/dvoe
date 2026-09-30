// Цвета, шрифты и размеры — единые для всего приложения (тёмная тема, аврора + стекло)
export const C = {
  bg: '#0B0A14',
  bg2: '#12101C',
  glass: 'rgba(255,255,255,0.06)',
  glassStrong: 'rgba(255,255,255,0.1)',
  glassBorder: 'rgba(255,255,255,0.13)',
  card: '#17151F',
  card2: '#221F2D',
  border: 'rgba(255,255,255,0.1)',
  text: '#F6F3FF',
  muted: 'rgba(246,243,255,0.68)',
  faint: 'rgba(246,243,255,0.45)',
  accent: '#FF6B8A',
  accentSoft: 'rgba(255,107,138,0.18)',
  onAccent: '#24101A',
  me: '#8FA2FF',
  partner: '#FF9EBB',
  good: '#5ED3A0',
  warn: '#FFC266',
  bad: '#FF6B6B',
  sleep: '#9B8CFF',
  ink: '#2B2035',
  overlay: 'rgba(22,18,38,0.66)',
} as const;

// Шрифты: Unbounded — заголовки и цифры, Nunito — текст (оба с кириллицей)
export const F = {
  regular: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  heavy: 'Nunito_800ExtraBold',
  display: 'Unbounded_700Bold',
  displaySemi: 'Unbounded_600SemiBold',
} as const;

export const R = { sm: 12, md: 16, lg: 22, xl: 28, pill: 999 } as const;
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

// Место под плавающие вкладки внизу экрана
export const TAB_BAR_SPACE = 104;

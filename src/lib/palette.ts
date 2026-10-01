// Цвета гардероба: две палитры по 10 и 5 тонов кожи.
// Файл без импортов — его же берёт tools/art (рисунки и каталог), поэтому цвета не разъезжаются.
// Ключи цветов совпадают с private.color_ok в supabase/schema.sql.

export const CLOTH: Record<string, [string, string]> = {
  coal: ['Уголь', '#3A3346'],
  milk: ['Молоко', '#F4F0FF'],
  strawberry: ['Клубника', '#FF8FB3'],
  cherry: ['Вишня', '#E5566B'],
  apricot: ['Абрикос', '#FFAA6B'],
  lemon: ['Лимон', '#FFD966'],
  mint: ['Мята', '#5ED3A0'],
  sky: ['Небо', '#7CC8FF'],
  blueberry: ['Черника', '#7F8CFF'],
  lavender: ['Лаванда', '#B39DFF'],
};

export const HAIR: Record<string, [string, string]> = {
  coal: ['Уголь', '#2E2438'],
  chocolate: ['Шоколад', '#7A4A33'],
  chestnut: ['Каштан', '#9C5B3B'],
  caramel: ['Карамель', '#C98A4B'],
  blond: ['Блонд', '#F0CF7A'],
  ginger: ['Рыжий', '#E0703A'],
  plum: ['Слива', '#5B4A6E'],
  pink: ['Розовый', '#FF9EC4'],
  blue: ['Голубой', '#8FC8FF'],
  silver: ['Седой', '#D9D4E8'],
};

export const SKIN = ['#FFE6D5', '#FFDCC4', '#F1C09A', '#C98E68', '#8D5A3E'];

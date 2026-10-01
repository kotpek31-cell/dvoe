// Стартовый каталог вещей внутри приложения. ФАЙЛ СОБИРАЕТСЯ СКРИПТОМ:
// node tools/art/catalog.ts — руками не править. Тот же каталог лежит в базе (supabase/catalog.sql);
// приложение берёт отсюда, пока не скачает свежий из базы.
import type { ItemRow } from './catalog';

export const STARTER_ITEMS: ItemRow[] = [
 {
  "id": "hair.vikhor",
  "cat": "hair",
  "name": "Вихор",
  "source": "free",
  "palette": "hair",
  "def_color": "coal",
  "sort": 10,
  "art": {
   "layers": {
    "hairFront": "<path d=\"M15 66 C11 38 30 17 60 17 C90 17 109 38 105 66 C102 58 98 52 93 49 C92 54 89 57 85 58 C85 52 82 47 77 45 C75 51 70 55 63 55 C65 50 64 46 61 43 C57 50 50 55 41 55 C44 51 45 47 44 44 C38 48 34 54 31 58 C30 53 28 50 26 49 C21 53 17 59 15 66 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M59 18 C56 10 62 3 71 4 C66 7 64 11 65 18 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M33 31 C40 24 50 21 58 21\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.3\"></path>"
   }
  },
  "meta": {},
  "rarity": 0
 },
 {
  "id": "hair.long",
  "cat": "hair",
  "name": "Длинные с чёлкой",
  "source": "free",
  "palette": "hair",
  "def_color": "chocolate",
  "sort": 20,
  "art": {
   "layers": {
    "hairBack": "<path d=\"M14 68 C10 36 32 16 60 16 C88 16 110 36 106 68 C106 84 108 100 112 116 C114 125 109 132 101 132 C95 132 91 128 89 122 L31 122 C29 128 25 132 19 132 C11 132 6 125 8 116 C12 100 14 84 14 68 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path>",
    "hairFront": "<path d=\"M15 70 C11 38 32 16 60 16 C88 16 109 38 105 70 C103 63 101 58 98 54 C94 58 89 58 85 55 C82 59 76 60 71 57 C67 61 62 61 58 58 C54 61 48 61 45 57 C41 60 36 59 32 55 C28 58 23 58 21 54 C18 59 16 64 15 70 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M16 62 C12 78 12 96 17 112 C21 108 23 98 24 88 C25 78 24 70 23 60 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M104 62 C108 78 108 96 103 112 C99 108 97 98 96 88 C95 78 96 70 97 60 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M31 31 C39 23 50 20 60 20 M72 21 C79 22 85 25 89 30\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.3\"></path>"
   }
  },
  "meta": {},
  "rarity": 0
 },
 {
  "id": "hair.fluffy",
  "cat": "hair",
  "name": "Пушистая",
  "source": "free",
  "palette": "hair",
  "def_color": "plum",
  "sort": 30,
  "art": {
   "layers": {
    "hairBack": "<path d=\"M14 68 C10 36 32 16 60 16 C88 16 110 36 106 68 C107 80 106 90 101 97 L19 97 C14 90 13 80 14 68 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path>",
    "hairFront": "<path d=\"M15 70 C11 38 32 16 60 16 C88 16 109 38 105 70 C103 62 100 55 95 50 C88 55 76 54 68 44 C66 50 62 53 60 53 C58 53 54 50 52 44 C44 54 32 55 25 50 C20 55 17 62 15 70 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M16 62 C12 74 13 86 18 96 C20 92 23 90 26 90 C24 82 23 72 23 62 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M104 62 C108 74 107 86 102 96 C100 92 97 90 94 90 C96 82 97 72 97 62 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M31 31 C39 23 50 20 60 20\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.3\"></path>"
   }
  },
  "meta": {},
  "rarity": 0
 },
 {
  "id": "hair.ponytail",
  "cat": "hair",
  "name": "Хвостик",
  "source": "free",
  "palette": "hair",
  "def_color": "caramel",
  "sort": 40,
  "art": {
   "layers": {
    "hairBack": "<path d=\"M90 30 C106 22 122 36 121 58 C120 76 112 92 103 100 C104 86 104 70 99 58 C96 48 93 40 90 30 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M99 58 C103 70 104 82 103 94\" fill=\"none\" stroke=\"@c|d0.25\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.7\"></path>",
    "hairFront": "<path d=\"M15 70 C11 38 32 16 60 16 C88 16 109 38 105 70 C103 63 101 58 98 54 C94 58 89 58 85 55 C82 59 76 60 71 57 C67 61 62 61 58 58 C54 61 48 61 45 57 C41 60 36 59 32 55 C28 58 23 58 21 54 C18 59 16 64 15 70 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M31 31 C39 23 50 20 60 20\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.3\"></path><circle cx=\"93\" cy=\"31\" r=\"4.6\" fill=\"#FF6B8A\" stroke=\"#2B2035\" stroke-width=\"1.8\"></circle>"
   }
  },
  "meta": {},
  "rarity": 0
 },
 {
  "id": "hair.bob",
  "cat": "hair",
  "name": "Каре",
  "source": "code",
  "palette": "hair",
  "def_color": "coal",
  "sort": 50,
  "art": {
   "layers": {
    "hairBack": "<path d=\"M14 66 C10 34 32 15 60 15 C88 15 110 34 106 66 C107 78 108 88 104 96 C101 101 95 102 91 99 L29 99 C25 102 19 101 16 96 C12 88 13 78 14 66 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path>",
    "hairFront": "<path d=\"M15 66 C11 36 32 15 60 15 C88 15 109 36 105 66 C104 59 102 54 99 50 C95 53 90 53 86 50 C83 54 77 55 73 51 C69 55 63 55 60 51 C57 55 51 55 47 51 C43 55 37 54 34 50 C30 53 25 53 21 50 C18 54 16 59 15 66 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M16 58 C12 72 12 86 16 96 C19 100 25 100 27 96 C25 92 24 86 24 80 C24 72 24 64 23 58 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M104 58 C108 72 108 86 104 96 C101 100 95 100 93 96 C95 92 96 86 96 80 C96 72 96 64 97 58 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M40 22 C34 30 31 40 31 48 M60 19 C57 28 56 38 57 47 M80 22 C86 30 89 40 89 48\" fill=\"none\" stroke=\"@c|l0.22\" stroke-width=\"1.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.55\"></path><path d=\"M19 70 C18 80 19 88 21 94 M101 70 C102 80 101 88 99 94\" fill=\"none\" stroke=\"@c|l0.22\" stroke-width=\"1.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.5\"></path><path d=\"M30 30 C38 22 48 19 58 19\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"3.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.32\"></path><path d=\"M72 20 C80 21 86 24 90 28\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.25\"></path>"
   }
  },
  "meta": {},
  "rarity": 0
 },
 {
  "id": "eyes.classic",
  "cat": "eyes",
  "name": "Обычные",
  "source": "free",
  "palette": "cloth",
  "def_color": "coal",
  "sort": 10,
  "art": {},
  "meta": {
   "style": "classic"
  },
  "rarity": 0
 },
 {
  "id": "eyes.lashes",
  "cat": "eyes",
  "name": "С ресничками",
  "source": "free",
  "palette": "cloth",
  "def_color": "coal",
  "sort": 20,
  "art": {},
  "meta": {
   "style": "lashes"
  },
  "rarity": 0
 },
 {
  "id": "eyes.sparkle",
  "cat": "eyes",
  "name": "Сияющие",
  "source": "free",
  "palette": "cloth",
  "def_color": "blueberry",
  "sort": 30,
  "art": {},
  "meta": {
   "style": "sparkle"
  },
  "rarity": 0
 },
 {
  "id": "eyes.sleepy",
  "cat": "eyes",
  "name": "Сонные",
  "source": "free",
  "palette": "cloth",
  "def_color": "coal",
  "sort": 40,
  "art": {},
  "meta": {
   "style": "sleepy"
  },
  "rarity": 0
 },
 {
  "id": "eyes.azure",
  "cat": "eyes",
  "name": "Дымка",
  "source": "code",
  "palette": null,
  "def_color": null,
  "sort": 50,
  "art": {},
  "meta": {
   "style": "azure"
  },
  "rarity": 0
 },
 {
  "id": "hat.beanie",
  "cat": "hat",
  "name": "Бини",
  "source": "free",
  "palette": "cloth",
  "def_color": "cherry",
  "sort": 10,
  "art": {
   "layers": {
    "hat": "<path d=\"M17 50 C15 24 35 9 60 9 C85 9 105 24 103 50 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M40 16 V46 M60 10 V46 M80 16 V46\" fill=\"none\" stroke=\"@c|d0.2\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.55\"></path><path d=\"M14 50 C14 45 17 43 21 43 H99 C103 43 106 45 106 50 C106 55 103 57 99 57 H21 C17 57 14 55 14 50 Z\" fill=\"@c|d0.12\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><circle cx=\"60\" cy=\"7\" r=\"7.5\" fill=\"@c|l0.35\" stroke=\"#2B2035\" stroke-width=\"2.2\"></circle>"
   }
  },
  "meta": {},
  "rarity": 0
 },
 {
  "id": "hat.cap",
  "cat": "hat",
  "name": "Кепка",
  "source": "free",
  "palette": "cloth",
  "def_color": "blueberry",
  "sort": 20,
  "art": {
   "layers": {
    "hat": "<path d=\"M18 50 C16 25 36 11 60 11 C84 11 104 25 102 50 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M56 44 C70 41 98 41 114 48 C108 55 82 56 56 51 Z\" fill=\"@c|d0.15\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M60 12 C58 24 58 36 60 48\" fill=\"none\" stroke=\"@c|d0.25\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.6\"></path><circle cx=\"60\" cy=\"12\" r=\"3.4\" fill=\"@c|l0.3\" stroke=\"#2B2035\" stroke-width=\"1.8\"></circle>"
   }
  },
  "meta": {},
  "rarity": 0
 },
 {
  "id": "hat.panama",
  "cat": "hat",
  "name": "Панама",
  "source": "free",
  "palette": "cloth",
  "def_color": "lemon",
  "sort": 30,
  "art": {
   "layers": {
    "hat": "<path d=\"M28 38 C28 20 42 11 60 11 C78 11 92 20 92 38 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M28 36 H92 V41 H28 Z\" fill=\"@c|d0.22\" stroke=\"#2B2035\" stroke-width=\"1.6\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M6 44 C6 36 30 34 60 34 C90 34 114 36 114 44 C114 51 92 53 60 53 C28 53 6 51 6 44 Z\" fill=\"@c|l0.12\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path>"
   }
  },
  "meta": {},
  "rarity": 0
 },
 {
  "id": "hat.bow",
  "cat": "hat",
  "name": "Бантик",
  "source": "free",
  "palette": "cloth",
  "def_color": "cherry",
  "sort": 40,
  "art": {
   "layers": {
    "hat": "<g transform=\"translate(87 23) rotate(18) scale(1.15)\"><path d=\"M0 0 C-4 -7 -12 -8 -12 -1 C-12 6 -4 5 0 0 Z M0 0 C4 -7 12 -8 12 -1 C12 6 4 5 0 0 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"1.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><circle cx=\"0\" cy=\"-0.5\" r=\"3\" fill=\"@c|l0.3\" stroke=\"#2B2035\" stroke-width=\"1.6\"></circle></g>"
   }
  },
  "meta": {},
  "rarity": 0
 },
 {
  "id": "hat.beret",
  "cat": "hat",
  "name": "Берет",
  "source": "code",
  "palette": "cloth",
  "def_color": "cherry",
  "sort": 50,
  "art": {
   "layers": {
    "hat": "<g transform=\"rotate(-8 60 30)\"><path d=\"M14 34 C18 17 42 8 64 10 C88 12 108 22 106 35 C104 42 92 44 78 42 C58 39 34 44 21 42 C15 41 13 38 14 34 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M62 10 L64 2\" fill=\"none\" stroke=\"#2B2035\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path><path d=\"M24 38 C44 35 70 34 98 38\" fill=\"none\" stroke=\"@c|d0.25\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.6\"></path></g>"
   }
  },
  "meta": {},
  "rarity": 0
 },
 {
  "id": "hat.halo",
  "cat": "hat",
  "name": "Нимб",
  "source": "code",
  "palette": null,
  "def_color": null,
  "sort": 60,
  "art": {
   "layers": {
    "over": "<ellipse cx=\"60\" cy=\"0\" rx=\"30\" ry=\"9\" fill=\"none\" stroke=\"#FFE89A\" stroke-width=\"9\" opacity=\"0.3\"></ellipse><ellipse cx=\"60\" cy=\"0\" rx=\"25\" ry=\"6.5\" fill=\"none\" stroke=\"#2B2035\" stroke-width=\"6.4\"></ellipse><ellipse cx=\"60\" cy=\"0\" rx=\"25\" ry=\"6.5\" fill=\"none\" stroke=\"#FFD45E\" stroke-width=\"3.6\"></ellipse><path d=\"M40 -3 C48 -6 60 -7 72 -5\" fill=\"none\" stroke=\"#FFF6CF\" stroke-width=\"1.4\" stroke-linecap=\"round\"></path>"
   }
  },
  "meta": {},
  "rarity": 0
 },
 {
  "id": "top.hoodie",
  "cat": "top",
  "name": "Худи",
  "source": "free",
  "palette": "cloth",
  "def_color": "blueberry",
  "sort": 10,
  "art": {
   "layers": {
    "body": "<path d=\"M40 104 C40 99 47 96 60 96 C73 96 80 99 80 104 L84 128 C85 134 81 137 76 137 L44 137 C39 137 35 134 36 128 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M47 123 C52 119 68 119 73 123 L72 132 L48 132 Z\" fill=\"@c|d0.14\" stroke=\"#2B2035\" stroke-width=\"1.4\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M55 102 L54.5 111 M65 102 L65.5 111\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.9\"></path>"
   }
  },
  "meta": {
   "sleeve": "full"
  },
  "rarity": 0
 },
 {
  "id": "top.tee",
  "cat": "top",
  "name": "Футболка",
  "source": "free",
  "palette": "cloth",
  "def_color": "lemon",
  "sort": 20,
  "art": {
   "layers": {
    "body": "<path d=\"M40 104 C40 99 47 96 60 96 C73 96 80 99 80 104 L84 128 C85 134 81 137 76 137 L44 137 C39 137 35 134 36 128 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M51 97.4 Q60 106 69 97.4 Q60 96 51 97.4 Z\" fill=\"@skin\" stroke=\"#2B2035\" stroke-width=\"1.4\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M55 117 l2.5 -5 l2.5 5 l2.5 -5 l2.5 5\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.85\"></path>"
   }
  },
  "meta": {
   "sleeve": "short"
  },
  "rarity": 0
 },
 {
  "id": "top.sweater",
  "cat": "top",
  "name": "Свитер с сердечком",
  "source": "free",
  "palette": "cloth",
  "def_color": "lavender",
  "sort": 30,
  "art": {
   "layers": {
    "body": "<path d=\"M40 104 C40 99 47 96 60 96 C73 96 80 99 80 104 L84 128 C85 134 81 137 76 137 L44 137 C39 137 35 134 36 128 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M50 98 Q60 102 70 98\" fill=\"none\" stroke=\"@c|d0.3\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path><path d=\"M37.5 131.5 C50 133.6 70 133.6 82.5 131.5\" fill=\"none\" stroke=\"@c|d0.3\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.8\"></path><g transform=\"translate(60 116.5) scale(1.35)\"><path d=\"M0 4.6 C-1.6 3.3 -6.6 0.3 -6.6 -2.6 C-6.6 -5.2 -4.5 -6.7 -2.7 -6.7 C-1.4 -6.7 -0.5 -6 0 -5.1 C0.5 -6 1.4 -6.7 2.7 -6.7 C4.5 -6.7 6.6 -5.2 6.6 -2.6 C6.6 0.3 1.6 3.3 0 4.6 Z\" fill=\"@c|k\" stroke=\"#2B2035\" stroke-width=\"1.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path></g>"
   }
  },
  "meta": {
   "sleeve": "full"
  },
  "rarity": 0
 },
 {
  "id": "top.dress",
  "cat": "top",
  "name": "Платье",
  "source": "free",
  "palette": "cloth",
  "def_color": "strawberry",
  "sort": 40,
  "art": {
   "layers": {
    "body": "<path d=\"M41 103 C41 98.5 48 96 60 96 C72 96 79 98.5 79 103 L86 133 C87 138 83 140 78 140 L42 140 C37 140 33 138 34 133 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M35 132.5 C47 135.5 73 135.5 85 132.5\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.85\"></path><path d=\"M47 99.5 C49 106 56 107 60 102 C64 107 71 106 73 99.5 C68 98 52 98 47 99.5 Z\" fill=\"#FFFFFF\" stroke=\"#2B2035\" stroke-width=\"1.4\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path>"
   }
  },
  "meta": {
   "sleeve": "full",
   "coversBottom": true
  },
  "rarity": 0
 },
 {
  "id": "top.apron",
  "cat": "top",
  "name": "Фартук художника",
  "source": "code",
  "palette": "cloth",
  "def_color": "sky",
  "sort": 50,
  "art": {
   "layers": {
    "body": "<path d=\"M40 104 C40 99 47 96 60 96 C73 96 80 99 80 104 L84 128 C85 134 81 137 76 137 L44 137 C39 137 35 134 36 128 Z\" fill=\"#F4F0FF\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M51 97.4 Q60 106 69 97.4 Q60 96 51 97.4 Z\" fill=\"@skin\" stroke=\"#2B2035\" stroke-width=\"1.4\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M46.5 106 H73.5 L76 133 C76 135.5 74.5 137 72 137 L48 137 C45.5 137 44 135.5 44 133 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"1.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M47.5 106 L44 98 M72.5 106 L76 98\" fill=\"none\" stroke=\"@c|d0.2\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path><path d=\"M53 124 H67 V131 H53 Z\" fill=\"@c|d0.12\" stroke=\"#2B2035\" stroke-width=\"1.4\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><circle cx=\"52\" cy=\"113\" r=\"2.6\" fill=\"#E5566B\"></circle><circle cx=\"68\" cy=\"116\" r=\"2.2\" fill=\"#FFD966\"></circle><circle cx=\"62\" cy=\"110\" r=\"1.6\" fill=\"#5ED3A0\"></circle><circle cx=\"56\" cy=\"119\" r=\"1.3\" fill=\"#7F8CFF\"></circle>"
   }
  },
  "meta": {
   "sleeve": "short",
   "sleeveColor": "milk"
  },
  "rarity": 0
 },
 {
  "id": "top.blackdress",
  "cat": "top",
  "name": "Чёрное платье",
  "source": "code",
  "palette": "cloth",
  "def_color": "coal",
  "sort": 60,
  "art": {
   "layers": {
    "body": "<path d=\"M41 103 C41 98.5 48 96 60 96 C72 96 79 98.5 79 103 L86 133 C87 138 83 140 78 140 L42 140 C37 140 33 138 34 133 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M39.6 110 C46 112 74 112 80.4 110 L81.2 114.5 C74 116.5 46 116.5 38.8 114.5 Z\" fill=\"@c|l0.12\" stroke=\"#2B2035\" stroke-width=\"1.4\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M50 118 L46 137 M60 118 V138 M70 118 L74 137\" fill=\"none\" stroke=\"@c|l0.18\" stroke-width=\"1.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.7\"></path><path d=\"M36 131 C48 134.5 72 134.5 84 131\" fill=\"none\" stroke=\"@c|l0.25\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.8\"></path><path d=\"M47 99.5 q3.25 5 6.5 0 q3.25 5 6.5 0 q3.25 5 6.5 0 q3.25 5 6.5 0 Q60 97.5 47 99.5 Z\" fill=\"#F4F0FF\" stroke=\"#2B2035\" stroke-width=\"1.3\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><g transform=\"translate(60 112.5) scale(0.62)\"><path d=\"M0 0 C-4 -7 -12 -8 -12 -1 C-12 6 -4 5 0 0 Z M0 0 C4 -7 12 -8 12 -1 C12 6 4 5 0 0 Z\" fill=\"#F4F0FF\" stroke=\"#2B2035\" stroke-width=\"1.3\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><circle cx=\"0\" cy=\"-0.4\" r=\"2.2\" fill=\"#F4F0FF\" stroke=\"#2B2035\" stroke-width=\"1.2\"></circle></g>"
   }
  },
  "meta": {
   "sleeve": "full",
   "cuff": "#F4F0FF",
   "coversBottom": true
  },
  "rarity": 0
 },
 {
  "id": "bottom.pants",
  "cat": "bottom",
  "name": "Брюки",
  "source": "free",
  "palette": "cloth",
  "def_color": "coal",
  "sort": 10,
  "art": {
   "layers": {
    "legL": "<rect x=\"47\" y=\"124\" width=\"11\" height=\"24\" rx=\"5\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\"></rect><path d=\"M48.5 145 H56.5\" fill=\"none\" stroke=\"@c|d0.3\" stroke-width=\"1.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.7\"></path>",
    "legR": "<rect x=\"62\" y=\"124\" width=\"11\" height=\"24\" rx=\"5\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\"></rect><path d=\"M63.5 145 H71.5\" fill=\"none\" stroke=\"@c|d0.3\" stroke-width=\"1.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.7\"></path>"
   }
  },
  "meta": {},
  "rarity": 0
 },
 {
  "id": "bottom.shorts",
  "cat": "bottom",
  "name": "Шорты",
  "source": "free",
  "palette": "cloth",
  "def_color": "sky",
  "sort": 20,
  "art": {
   "layers": {
    "under": "<path d=\"M37 128 H83 L85 139 C85 141 83 142 81 142 L63 142 L60 138.5 L57 142 L39 142 C37 142 35 141 35 139 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path>"
   }
  },
  "meta": {},
  "rarity": 0
 },
 {
  "id": "bottom.skirt",
  "cat": "bottom",
  "name": "Юбка",
  "source": "free",
  "palette": "cloth",
  "def_color": "lavender",
  "sort": 30,
  "art": {
   "layers": {
    "under": "<path d=\"M38 126 H82 L88 143 C88.5 145 87 146 85 146 L35 146 C33 146 31.5 145 32 143 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M48 132 L45 145 M60 132 V145 M72 132 L75 145\" fill=\"none\" stroke=\"@c|d0.2\" stroke-width=\"1.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.6\"></path>"
   }
  },
  "meta": {},
  "rarity": 0
 },
 {
  "id": "shoes.kedy",
  "cat": "shoes",
  "name": "Кеды",
  "source": "free",
  "palette": "cloth",
  "def_color": "milk",
  "sort": 10,
  "art": {
   "layers": {
    "shoeL": "<path d=\"M44 150 C44 145 47.5 143.5 52.5 143.5 C57.5 143.5 60 146 60 150.5 C60 154.5 57 156.5 52 156.5 C47 156.5 44 154.5 44 150 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M45 153.2 H59\" fill=\"none\" stroke=\"#B9B2CC\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path><path d=\"M50 146.5 h5\" fill=\"none\" stroke=\"@c|d0.35\" stroke-width=\"1.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path>",
    "shoeR": "<path d=\"M76 150 C76 145 72.5 143.5 67.5 143.5 C62.5 143.5 60 146 60 150.5 C60 154.5 63 156.5 68 156.5 C73 156.5 76 154.5 76 150 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M61 153.2 H75\" fill=\"none\" stroke=\"#B9B2CC\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path><path d=\"M65 146.5 h5\" fill=\"none\" stroke=\"@c|d0.35\" stroke-width=\"1.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path>"
   }
  },
  "meta": {},
  "rarity": 0
 },
 {
  "id": "shoes.boots",
  "cat": "shoes",
  "name": "Ботинки",
  "source": "free",
  "palette": "cloth",
  "def_color": "coal",
  "sort": 20,
  "art": {
   "layers": {
    "shoeL": "<rect x=\"46.4\" y=\"136\" width=\"12.2\" height=\"13\" rx=\"3\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\"></rect><path d=\"M44 150 C44 145 47.5 143.5 52.5 143.5 C57.5 143.5 60 146 60 150.5 C60 154.5 57 156.5 52 156.5 C47 156.5 44 154.5 44 150 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M45 153.4 H59\" fill=\"none\" stroke=\"@c|l0.3\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path><path d=\"M49 140 h7 M49 143.5 h7\" fill=\"none\" stroke=\"@c|l0.4\" stroke-width=\"1.1\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.8\"></path>",
    "shoeR": "<rect x=\"61.4\" y=\"136\" width=\"12.2\" height=\"13\" rx=\"3\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\"></rect><path d=\"M76 150 C76 145 72.5 143.5 67.5 143.5 C62.5 143.5 60 146 60 150.5 C60 154.5 63 156.5 68 156.5 C73 156.5 76 154.5 76 150 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M61 153.4 H75\" fill=\"none\" stroke=\"@c|l0.3\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path><path d=\"M64 140 h7 M64 143.5 h7\" fill=\"none\" stroke=\"@c|l0.4\" stroke-width=\"1.1\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.8\"></path>"
   }
  },
  "meta": {},
  "rarity": 0
 },
 {
  "id": "shoes.sapozhki",
  "cat": "shoes",
  "name": "Сапожки",
  "source": "free",
  "palette": "cloth",
  "def_color": "cherry",
  "sort": 30,
  "art": {
   "layers": {
    "shoeL": "<rect x=\"46\" y=\"131\" width=\"13\" height=\"18\" rx=\"4\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\"></rect><rect x=\"45.2\" y=\"128.5\" width=\"14.6\" height=\"6.5\" rx=\"3.2\" fill=\"@c|l0.4\" stroke=\"#2B2035\" stroke-width=\"1.8\"></rect><path d=\"M44 150 C44 145 47.5 143.5 52.5 143.5 C57.5 143.5 60 146 60 150.5 C60 154.5 57 156.5 52 156.5 C47 156.5 44 154.5 44 150 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path>",
    "shoeR": "<rect x=\"61\" y=\"131\" width=\"13\" height=\"18\" rx=\"4\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\"></rect><rect x=\"60.2\" y=\"128.5\" width=\"14.6\" height=\"6.5\" rx=\"3.2\" fill=\"@c|l0.4\" stroke=\"#2B2035\" stroke-width=\"1.8\"></rect><path d=\"M76 150 C76 145 72.5 143.5 67.5 143.5 C62.5 143.5 60 146 60 150.5 C60 154.5 63 156.5 68 156.5 C73 156.5 76 154.5 76 150 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path>"
   }
  },
  "meta": {},
  "rarity": 0
 },
 {
  "id": "back.backpack",
  "cat": "back",
  "name": "Рюкзак",
  "source": "free",
  "palette": "cloth",
  "def_color": "apricot",
  "sort": 10,
  "art": {
   "layers": {
    "back": "<path d=\"M31 102 C31 95 37 91 45 91 H75 C83 91 89 95 89 102 V129 C89 135 85 139 79 139 H41 C35 139 31 135 31 129 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path>",
    "front": "<path d=\"M48 99 C46 108 45.5 118 45.5 129 M72 99 C74 108 74.5 118 74.5 129\" fill=\"none\" stroke=\"#2B2035\" stroke-width=\"5.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path><path d=\"M48 99 C46 108 45.5 118 45.5 129 M72 99 C74 108 74.5 118 74.5 129\" fill=\"none\" stroke=\"@c|d0.1\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path>"
   }
  },
  "meta": {},
  "rarity": 0
 },
 {
  "id": "back.wings",
  "cat": "back",
  "name": "Крылья ангела",
  "source": "code",
  "palette": null,
  "def_color": null,
  "sort": 20,
  "art": {
   "layers": {
    "back": "<g><path d=\"M46 104 C40 92 28 82 12 80 C2 79 -8 84 -10 92 C-4 92 0 94 0 98 C-6 99 -9 103 -8 108 C-2 106 3 107 5 111 C0 113 -1 117 2 120 C8 117 14 117 18 120 C17 124 19 127 24 128 C30 124 36 124 40 126 C46 120 48 112 46 104 Z\" fill=\"#FFFFFF\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M40 100 C30 92 18 89 4 92 M40 106 C30 102 18 101 6 104 M41 112 C33 110 24 111 16 116 M43 118 C38 117 32 119 28 124\" fill=\"none\" stroke=\"#C9B6FF\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.9\"></path><path d=\"M14 84 C22 84 30 88 36 94\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"0\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path></g><g transform=\"translate(120 0) scale(-1 1)\"><path d=\"M46 104 C40 92 28 82 12 80 C2 79 -8 84 -10 92 C-4 92 0 94 0 98 C-6 99 -9 103 -8 108 C-2 106 3 107 5 111 C0 113 -1 117 2 120 C8 117 14 117 18 120 C17 124 19 127 24 128 C30 124 36 124 40 126 C46 120 48 112 46 104 Z\" fill=\"#FFFFFF\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M40 100 C30 92 18 89 4 92 M40 106 C30 102 18 101 6 104 M41 112 C33 110 24 111 16 116 M43 118 C38 117 32 119 28 124\" fill=\"none\" stroke=\"#C9B6FF\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.9\"></path><path d=\"M14 84 C22 84 30 88 36 94\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"0\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path></g>"
   }
  },
  "meta": {
   "hover": true
  },
  "rarity": 0
 },
 {
  "id": "hand.balloon",
  "cat": "hand",
  "name": "Шарик-сердце",
  "source": "free",
  "palette": "cloth",
  "def_color": "cherry",
  "sort": 10,
  "art": {
   "layers": {
    "handR": "<path d=\"M81 126 C96 112 124 88 139 70\" fill=\"none\" stroke=\"#2B2035\" stroke-width=\"1.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path><g transform=\"translate(141 57) scale(2.2)\"><path d=\"M0 4.6 C-1.6 3.3 -6.6 0.3 -6.6 -2.6 C-6.6 -5.2 -4.5 -6.7 -2.7 -6.7 C-1.4 -6.7 -0.5 -6 0 -5.1 C0.5 -6 1.4 -6.7 2.7 -6.7 C4.5 -6.7 6.6 -5.2 6.6 -2.6 C6.6 0.3 1.6 3.3 0 4.6 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"0.95\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><ellipse cx=\"-2.6\" cy=\"-3.4\" rx=\"1.4\" ry=\"0.9\" fill=\"#FFFFFF\" opacity=\"0.7\"></ellipse></g>"
   }
  },
  "meta": {},
  "rarity": 0
 },
 {
  "id": "hand.cocoa",
  "cat": "hand",
  "name": "Чашка какао",
  "source": "free",
  "palette": "cloth",
  "def_color": "mint",
  "sort": 20,
  "art": {
   "layers": {
    "handR": "<path d=\"M98.4 120.5 a3.6 3.6 0 0 1 0 7.2\" fill=\"none\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path><path d=\"M83.5 117 H98.5 V127 A3.5 3.5 0 0 1 95 130.5 H87 A3.5 3.5 0 0 1 83.5 127 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><ellipse cx=\"91\" cy=\"117.8\" rx=\"6.2\" ry=\"1.6\" fill=\"#7A4A33\"></ellipse><path d=\"M88 112 q-2 -3 0 -6 M94 112 q-2 -3 0 -6\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.85\"></path>"
   }
  },
  "meta": {},
  "rarity": 0
 },
 {
  "id": "hand.bouquet",
  "cat": "hand",
  "name": "Букет",
  "source": "free",
  "palette": "cloth",
  "def_color": "lavender",
  "sort": 30,
  "art": {
   "layers": {
    "handR": "<path d=\"M81 124 L77 104 M82 124 L84 100 M83 124 L90 106\" fill=\"none\" stroke=\"#3E9A62\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path><circle cx=\"77.00\" cy=\"99.80\" r=\"2.6\" fill=\"#FF8FB3\" stroke=\"#2B2035\" stroke-width=\"0.9\"></circle><circle cx=\"80.04\" cy=\"102.01\" r=\"2.6\" fill=\"#FF8FB3\" stroke=\"#2B2035\" stroke-width=\"0.9\"></circle><circle cx=\"78.88\" cy=\"105.59\" r=\"2.6\" fill=\"#FF8FB3\" stroke=\"#2B2035\" stroke-width=\"0.9\"></circle><circle cx=\"75.12\" cy=\"105.59\" r=\"2.6\" fill=\"#FF8FB3\" stroke=\"#2B2035\" stroke-width=\"0.9\"></circle><circle cx=\"73.96\" cy=\"102.01\" r=\"2.6\" fill=\"#FF8FB3\" stroke=\"#2B2035\" stroke-width=\"0.9\"></circle><circle cx=\"77\" cy=\"103\" r=\"1.8\" fill=\"#FFB347\"></circle><circle cx=\"84.00\" cy=\"94.80\" r=\"2.6\" fill=\"#FFD966\" stroke=\"#2B2035\" stroke-width=\"0.9\"></circle><circle cx=\"87.04\" cy=\"97.01\" r=\"2.6\" fill=\"#FFD966\" stroke=\"#2B2035\" stroke-width=\"0.9\"></circle><circle cx=\"85.88\" cy=\"100.59\" r=\"2.6\" fill=\"#FFD966\" stroke=\"#2B2035\" stroke-width=\"0.9\"></circle><circle cx=\"82.12\" cy=\"100.59\" r=\"2.6\" fill=\"#FFD966\" stroke=\"#2B2035\" stroke-width=\"0.9\"></circle><circle cx=\"80.96\" cy=\"97.01\" r=\"2.6\" fill=\"#FFD966\" stroke=\"#2B2035\" stroke-width=\"0.9\"></circle><circle cx=\"84\" cy=\"98\" r=\"1.8\" fill=\"#FFB347\"></circle><circle cx=\"90.50\" cy=\"101.80\" r=\"2.6\" fill=\"#F4F0FF\" stroke=\"#2B2035\" stroke-width=\"0.9\"></circle><circle cx=\"93.54\" cy=\"104.01\" r=\"2.6\" fill=\"#F4F0FF\" stroke=\"#2B2035\" stroke-width=\"0.9\"></circle><circle cx=\"92.38\" cy=\"107.59\" r=\"2.6\" fill=\"#F4F0FF\" stroke=\"#2B2035\" stroke-width=\"0.9\"></circle><circle cx=\"88.62\" cy=\"107.59\" r=\"2.6\" fill=\"#F4F0FF\" stroke=\"#2B2035\" stroke-width=\"0.9\"></circle><circle cx=\"87.46\" cy=\"104.01\" r=\"2.6\" fill=\"#F4F0FF\" stroke=\"#2B2035\" stroke-width=\"0.9\"></circle><circle cx=\"90.5\" cy=\"105\" r=\"1.8\" fill=\"#FFB347\"></circle><path d=\"M74.5 112 L90.5 112 L84 131 L81 131 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"1.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path>"
   }
  },
  "meta": {},
  "rarity": 0
 },
 {
  "id": "hand.brush",
  "cat": "hand",
  "name": "Кисть с палитрой",
  "source": "code",
  "palette": null,
  "def_color": null,
  "sort": 40,
  "art": {
   "layers": {
    "handR": "<path d=\"M76 135 L95.6 106.6\" fill=\"none\" stroke=\"#2B2035\" stroke-width=\"5.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path><path d=\"M76 135 L95.6 106.6\" fill=\"none\" stroke=\"#D79A5A\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path><path d=\"M77.4 132.4 L94 108\" fill=\"none\" stroke=\"#F0C08A\" stroke-width=\"1\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.8\"></path><path d=\"M95 107.4 L98.6 102.2\" fill=\"none\" stroke=\"#2B2035\" stroke-width=\"5.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path><path d=\"M95 107.4 L98.6 102.2\" fill=\"none\" stroke=\"#D9D4E8\" stroke-width=\"3.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path><path d=\"M97.2 102.6 C95.6 98 98.4 92.4 105 88.4 C105.8 94 104.2 99.2 100.8 104.4 Z\" fill=\"#4A3A2E\" stroke=\"#2B2035\" stroke-width=\"1.7\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M101.6 94.6 C102.4 91.6 103.6 89.8 105 88.4 C105.2 91.2 104.6 93.6 103.4 96 Z\" fill=\"#E5566B\" stroke=\"#2B2035\" stroke-width=\"0\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><circle cx=\"104.6\" cy=\"99.6\" r=\"1.3\" fill=\"#E5566B\"></circle>",
    "handL": "<path d=\"M17 127 C16 119 24 113.5 32.5 114.5 C41 115.5 46 121 45 127.5 C44 133.5 37 137.5 29.5 136.5 C26.5 136 26.5 132.5 23.5 132.5 C19.5 132.5 17.2 130.5 17 127 Z\" fill=\"#E9C48A\" stroke=\"#2B2035\" stroke-width=\"1.9\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M21 125 C22 120 27 117 32 117\" fill=\"none\" stroke=\"#FFFFFF\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.45\"></path><circle cx=\"24\" cy=\"123\" r=\"2.4\" fill=\"#E5566B\" stroke=\"#2B2035\" stroke-width=\"0.8\"></circle><circle cx=\"30\" cy=\"119.5\" r=\"2.4\" fill=\"#FFD966\" stroke=\"#2B2035\" stroke-width=\"0.8\"></circle><circle cx=\"37\" cy=\"119.5\" r=\"2.4\" fill=\"#7CC8FF\" stroke=\"#2B2035\" stroke-width=\"0.8\"></circle><circle cx=\"26.5\" cy=\"130\" r=\"2.2\" fill=\"#5ED3A0\" stroke=\"#2B2035\" stroke-width=\"0.8\"></circle>"
   }
  },
  "meta": {},
  "rarity": 0
 },
 {
  "id": "hand.uzi",
  "cat": "hand",
  "name": "Узи",
  "source": "code",
  "palette": null,
  "def_color": null,
  "sort": 50,
  "art": {
   "layers": {
    "handR": "<rect x=\"82\" y=\"127\" width=\"6\" height=\"11\" rx=\"2\" fill=\"#3A3346\" stroke=\"#2B2035\" stroke-width=\"1.8\"></rect><rect x=\"91.5\" y=\"128\" width=\"4.6\" height=\"10\" rx=\"1.6\" fill=\"#2E2438\" stroke=\"#2B2035\" stroke-width=\"1.8\"></rect><rect x=\"78.5\" y=\"120.5\" width=\"23\" height=\"8.5\" rx=\"2.6\" fill=\"#4A4258\" stroke=\"#2B2035\" stroke-width=\"1.9\"></rect><rect x=\"101\" y=\"122.6\" width=\"5.5\" height=\"3.6\" rx=\"1.2\" fill=\"#3A3346\" stroke=\"#2B2035\" stroke-width=\"1.6\"></rect><path d=\"M81.5 123 H98\" fill=\"none\" stroke=\"#8E8AA6\" stroke-width=\"1.1\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.8\"></path>"
   }
  },
  "meta": {},
  "rarity": 0
 },
 {
  "id": "face.bandana",
  "cat": "face",
  "name": "Бандана на лицо",
  "source": "code",
  "palette": "cloth",
  "def_color": "cherry",
  "sort": 10,
  "art": {
   "layers": {
    "mask": "<path d=\"M19 76 C32 82 88 82 101 76 C103 86 99 96 91 102 C82 108 70 112 60 118 C50 112 38 108 29 102 C21 96 17 86 19 76 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M30 92 C42 98 52 100 60 104 M90 92 C78 98 68 100 60 104\" fill=\"none\" stroke=\"@c|d0.25\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"0.7\"></path><circle cx=\"30\" cy=\"84\" r=\"1.7\" fill=\"#FFFFFF\" opacity=\"0.9\"></circle><circle cx=\"44\" cy=\"88\" r=\"1.7\" fill=\"#FFFFFF\" opacity=\"0.9\"></circle><circle cx=\"60\" cy=\"90\" r=\"1.7\" fill=\"#FFFFFF\" opacity=\"0.9\"></circle><circle cx=\"76\" cy=\"88\" r=\"1.7\" fill=\"#FFFFFF\" opacity=\"0.9\"></circle><circle cx=\"90\" cy=\"84\" r=\"1.7\" fill=\"#FFFFFF\" opacity=\"0.9\"></circle><circle cx=\"38\" cy=\"97\" r=\"1.7\" fill=\"#FFFFFF\" opacity=\"0.9\"></circle><circle cx=\"52\" cy=\"102\" r=\"1.7\" fill=\"#FFFFFF\" opacity=\"0.9\"></circle><circle cx=\"68\" cy=\"102\" r=\"1.7\" fill=\"#FFFFFF\" opacity=\"0.9\"></circle><circle cx=\"82\" cy=\"97\" r=\"1.7\" fill=\"#FFFFFF\" opacity=\"0.9\"></circle><circle cx=\"60\" cy=\"110\" r=\"1.7\" fill=\"#FFFFFF\" opacity=\"0.9\"></circle><path d=\"M101 77 C108 74 114 76 117 80 C112 82 107 82 102 81 Z\" fill=\"@c\" stroke=\"#2B2035\" stroke-width=\"1.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><path d=\"M102 81 C108 84 112 89 112 94 C107 92 103 88 101 84 Z\" fill=\"@c|d0.12\" stroke=\"#2B2035\" stroke-width=\"1.8\" stroke-linejoin=\"round\" stroke-linecap=\"round\"></path><circle cx=\"101.5\" cy=\"80\" r=\"3\" fill=\"@c|d0.1\" stroke=\"#2B2035\" stroke-width=\"1.6\"></circle>"
   }
  },
  "meta": {},
  "rarity": 0
 },
 {
  "id": "ability.hug",
  "cat": "ability",
  "name": "Объятия",
  "source": "free",
  "palette": null,
  "def_color": null,
  "sort": 10,
  "art": {},
  "meta": {
   "cooldown_s": 10,
   "scene_s": 4,
   "push_every_s": 300
  },
  "rarity": 0
 },
 {
  "id": "ability.mog",
  "cat": "ability",
  "name": "Мог",
  "source": "code",
  "palette": null,
  "def_color": null,
  "sort": 20,
  "art": {},
  "meta": {
   "cooldown_s": 600,
   "scene_s": 7
  },
  "rarity": 0
 }
];

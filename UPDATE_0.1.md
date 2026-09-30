# «Двое» 0.1 — как поставить обновление

Пять шагов. Делай по порядку, по одному. Сайты открывай в Safari с «Версией для ПК».

## Шаг 1. Код (Codespace, ~5 минут)
1. Открой Codespace. В панели файлов слева: долгое нажатие на пустое место → **Upload…** → `dvoe.zip`.
2. В терминале набери:
   ```
   unzip -q dvoe.zip && bash dvoe/update.sh
   ```
   Скрипт сам удалит старые вкладки, скопирует новые файлы, поставит пакеты (1–3 минуты) и отправит всё в GitHub. В конце — «Готово».
3. Сайт обновится сам через 3–5 минут.

## Шаг 2. База данных (Supabase, 2 минуты) — сразу после шага 1
1. github.com/kotpek31-cell/dvoe → папка `supabase` → `schema.sql` → кнопка **Copy raw file** (значок двух квадратиков справа над кодом).
2. Supabase → **SQL Editor** → **New query** → вставить → **Run**.
3. Внизу должна появиться строка **«Схема «Двое» 0.1 применена»**. Старые записи не пропадут.

## Шаг 3. Уведомления на iPhone (Supabase, 5 минут)
1. github.com/kotpek31-cell/dvoe → `supabase` → `functions` → `push` → `index.ts` → **Copy raw file**.
2. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
3. Имя функции: `push`. Удали пример кода, вставь скопированный → **Deploy function**.
4. Открой функцию `push` → **Details** → выключи **Enforce JWT Verification** (Verify JWT) → **Save changes**. Без этого уведомления не дойдут.
5. Проверка: открой https://uvlausosjxzhytzyfduz.supabase.co/functions/v1/push — должно быть `{"publicKey":"B…"}`. Ключи функция создала сама, ничего копировать не нужно.
6. На iPhone открой «Двое» **с экрана «Домой»** → Профиль → ⚙️ Настройки → **Включить уведомления** → «Разрешить».

## Шаг 4. Уведомления на Android (Firebase, 10 минут, один раз)
1. console.firebase.google.com → **Create a project** → имя `Dvoe` → Google Analytics можно выключить → **Create**.
2. В проекте нажми значок **Android** → package name: `com.gaster.dvoe` → **Register app** → **Download google-services.json** → дальше **Next** до конца.
3. ⚙️ **Project settings** → **Service accounts** → **Generate new private key** → **Generate key**. Скачается JSON — это секрет, никому его не отправляй и не клади в GitHub.
4. expo.dev → Projects → **dvoe** → **Credentials** → **Android** → `com.gaster.dvoe` → **FCM V1 service account key** → **Add a service account key** → выбери JSON из пункта 3 → **Save**.
5. Codespace: загрузи `google-services.json` в корень проекта (так же, как архив: **Upload…**). Имя должно быть ровно `google-services.json`. В GitHub он не попадёт — так и задумано, а в сборку попадёт.

## Шаг 5. Новый APK (Codespace)
```
eas build -p android --profile preview
```
Через 10–30 минут появится ссылка — поставить поверх старого приложения. При первом запуске: выбрать чибика → разрешить уведомления → включить «Доступ к истории использования» для «Двое» (чтобы сон считался сам).

## Проверка
Нажми на главной на чибика партнёра — у него придёт «💗 Думаю о тебе».

## Если что-то не так
- «База данных ещё не обновлена до 0.1» — не сделан шаг 2.
- «Сервер уведомлений ещё не развёрнут» — не сделан шаг 3 или функция названа не `push`.
- «Включена проверка JWT» — шаг 3, пункт 4.
- На iPhone нет кнопки уведомлений — сайт открыт в Safari, а не с экрана «Домой»; нужен iOS 16.4 или новее.
- На Android «Default FirebaseApp is not initialized» — при сборке не было `google-services.json` (шаг 4, пункт 5): положи файл и собери APK ещё раз.
- Сайт не поменялся — подожди 10 минут или открой адрес с `?v=2` в конце.
- Скрипт в шаге 1 упал на `git push` — набери `git push` ещё раз.

После работы останови Codespace: github.com/codespaces → … → **Stop**.

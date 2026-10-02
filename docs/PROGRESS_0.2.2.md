# «Двое» 0.2.2 «Комната на троих» — передача между чатами

## Ссылки
- ТЗ (документ, подтверждено целиком): https://claude.ai/artifact/81cuzT1WvWS9hX9QTqw3fz
- Макет («пока сойдёт»): https://claude.ai/artifact/D4p9Uyd6k7qNkRoqS6bmbS — `node tools/art/mockup022.ts <файл.html>`
- Ветка: `claude/magical-newton-ng3oir` (в `main` ещё ничего не уходило)

## Статус по этапам
1. ТЗ и макет — готово.
2. База — **применено в Supabase 2 октября 2026** (раздел 12 в `supabase/schema.sql` + 4 вещи в `catalog.sql`). Перед применением прогнан тест с откатом от имени владельца, разработчика, гостя и чужого — всё сходится. Advisors: новых замечаний нет.
3. Комната (клиент) — следующий шаг, новый чат, уровень High (синхронизация — Extra).
4. Игры (колесо, 4 игры, пьедестал, рекорды) — Extra, отдельный чат.
5. Грибы, шляпа, отражённый «Мог» на клиенте — High.
6. Выпуск: «Что нового» (тизер «В лесу что-то выросло. Говорят, грибы любят порядок»), `main`, обновление Android через workflow Expo, CLAUDE.md.

## Решения (сверх ТЗ)
- Роли: `private.user_roles.role` = owner / developer / **guest** («Только комната»). `require_role` пускает только owner/developer. `my_access()` отдаёт role и title (по умолчанию: владелец / тестер / друг). **Клиент:** гаечный ключ показывать только owner/developer, плитку «Комната» — любой роли.
- `dev_set_role(p_query, p_title, p_level 'developer'|'guest')`; `dev_remove_role` заодно выводит из комнаты.
- Комната одна: `rooms.id = 'dev'`, capacity 2–6 (по умолчанию 3), location (по умолчанию forest), world_w = 3 экрана, world_d = 1,5. `code_fp` — задел под Портал.
- Участник: `room_members` (человек — user_id, бот — bot_owner + bot_name + bot_look). x, y — доли ширины мира и глубины земли (0..1). `seen_at` — «на экране комнаты» (клиент: `room_ping()` раз в 30 с, `room_ping(true)` при уходе с экрана; от этого зависят пуши).
- Канал комнаты: **закрытый** realtime `room:dev` (`config: { private: true }`), пускает только вошедших (политики на realtime.messages через `public.in_room`). Движения, реакции, «дай пять», ходы игр — broadcast, в базу не пишутся. Сохранять место — `room_move(x, y, member?)` по прибытии.
- Postgres changes (RLS — только своя комната): `rooms` (локация, лимит), `room_members` (вход/выход), `room_casts` (способности).
- Способности: `room_cast(target_member, ability, from_member?)` — любая из инвентаря, 15 с перезарядки, бот — только объятия. `blocked` = «Мог» в шляпу грибника. Пропущенные: `room_pending_casts()` / `room_mark_casts_seen(ids)`.
- Пуши: `room_notify('five', member)` и `room_notify('five_all')` (не чаще раза в 10 с от человека); способности и старт игры пушат сами. Получают все, кого минуту нет на экране, не чаще 1 в 30 с (способность на тебя — всегда).
- Игры: `room_game_start(member_ids[])` → `{id, game, seed, players}`; сервер выбирает игру (не ту же, что прошлая), одна игра за раз. Ведёт игру телефон хоста; итог — `room_game_finish(id, {places:[member ids], best:{member: число}})`. Минимум времени: stars 30 с, pumpkin/reaction 10 с, rps 6 с (+ колесо ~4 с и отсчёт). Рекорды и награды — только если людей ≥ 2. Награды: 1/10/25 побед — `hand.trophy` / `hat.champion` / `back.champion` (inventory.source = 'game'). `room_game_cancel(id)`, `room_records()`, `dev_room_reset_records()`.
- Грибы: цвета `red, blue, yellow, purple, white`; `mushroom_try(text[5])` — 5 попыток в сутки (по Москве), верно → `hat.mushroom` (source 'game'). `mushroom_hint()` — порядок для пещеры. `dev_set_mushrooms(text[5])` / `dev_mushrooms_set()` — только владелец. **Порядок ещё не задан** — пользователь задаст сам в комнате разработчиков (или назовёт в чате → через коннектор). В репозиторий не писать.
- Пара: `ability_casts.blocked`, `cast_ability` возвращает `blocked`; пуш «Шляпа грибника отразила «Мог»». Клиент ещё не рисует отражённую сцену.

## Грабли этой сессии
- Коннектор Supabase отклоняет даже чтение, если пользователь не успел подтвердить, — спросить и повторить.
- Раздел с delete/drop/revoke применяли так: `net.http_get` файла по коммиту → сверка md5 → `execute substring(content from '-- 12. 0.2.2' … до '-- Готово. Если внизу')` в `do`-блоке. Тест — тот же `do`-блок + `pg_temp.t(uid, метка, выражение)` (set local role authenticated + request.jwt.claims) и `raise exception` в конце для отката.
- В облаке Google Fonts в Playwright не грузятся (сертификат) — на скриншотах макета запасной шрифт, это нормально.

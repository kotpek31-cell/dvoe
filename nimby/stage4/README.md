# «Нимбы» — этап 4 «Живой мир» (готово к установке, Studio ещё не видел)

Сделано без Studio: код этапа 4 написан по договорённостям из плейса (`../CONTRACTS.md`), проверен статически (luau-lsp с типами Roblox и заглушками чужих API), чистая логика — тестами (`tests/run.sh`, 67 проверок).

## Что внутри

| Часть | Файлы |
|---|---|
| Сутки 24 мин, слой `daynight`, созвездия, сияние, светлячки, окна, закатный остров | `DayNightServer`, `NightClient`, `Config/Night` |
| Погода: ясно → облачно → гроза-фронт → дождь стихает → радуга (веса), молнии, метель, порывы, дрожь течений | `WeatherServer`, `WeatherClient`, `Config/WeatherCycle` |
| 3 кита (место от времени сервера, перенос на спине, песня, сад с секретом), медузы-батуты (+1 свет) | `Movers/*`, `Assets/WhaleBuilder`, `Assets/JellyBuilder`, `CreaturesServer`, `CreaturesClient`, `Config/Life` |
| Птицы-искорки, фоновые звуки регионов, ветер по высоте, глухо под облаками, звуковые зоны | `BirdsClient`, `AmbientClient`, `Config/Ambience` |
| Страж Храма: 3 фазы, 5 атак с телеграфами, сцена-знакомство, полоса здоровья, награда, разрушение | `GuardianServer`, `GuardianClient`, `Assets/GuardianBuilder`, `Config/Guardian` |
| Общее | `WorldMath`, `WorldClock`, `WorldFX`, `WorldBus`, `Stage4Progress` |
| Проверка одним Play-тестом → атрибуты `Stage4_*` | `Stage4Check` |

## Установка (на компе, Studio) — новый чат, Opus High

1. **Бэкап плейса:** File → Save to File As → `Nimby_4_<ДДММ>.rbxl`.
2. **Поставить файлы:** открыть `install.luau`, скопировать целиком в Command Bar (View → Command Bar) и нажать Enter. Через Claude: `execute_luau` с содержимым `install.luau`; если не влезет — по одному файлу из этой папки (`multi_edit` с пустым `old_string`, путь = путь папок).
   В выводе: `[stage4] готово: новых 27, обновлено 0`.
3. **Патч панели разработчика:** `patches/DevPanelServer.md` — 3 точечные вставки (бэкап `Backup_DevPanelServer_<ДДММ>`).
4. **Сверить TODO(studio)** (поиск `TODO(studio)` по скриптам). Главное:
   - `Stage4Progress`: `Progress.set(plr, key)` — это чтение набора? Есть ли в `Progress.ATTR` ключи `shards`, `lore`, `secrets`, `cosmetics`; добавить `flags` (флаги «встретил Стража», «победил»), иначе они не сохранятся между входами.
   - `WorldFX.USE_FLIGHT_KNOCK`: понимает ли `FlightClient` локальные `FlightKnock` (Vector3) / `FlightKnockT` (время сервера). Если нет — `false`.
   - Арена Стража: поставить деталь с тегом `ArchGuardianArena` на Верхнюю террасу Храма (атрибут `Radius`) — иначе Страж встанет на запасной площадке `Config.Guardian.ARENA_FALLBACK`.
   - Маршруты китов и стайки медуз — смещения от ORIGIN в `Config.Life`; подвинуть, если пересекают острова.
   - Звуки с `0` в `Config.Ambience` и `Config.Guardian.SND` — найти в Creator Store, ID дописать в скилл.
   - Текстуры дождя/снега (`Config.WeatherCycle.RAIN_FX/SNOW_FX.TEXTURE`).
5. **Play-тест (один):** запустить, подождать ~35 с, прочитать одним запросом
   `game.Players:GetPlayers()[1]:GetAttributes()` → `Stage4_Day`, `Stage4_Weather`, `Stage4_Whale`, `Stage4_Guardian`, `Stage4_OK`.
   Тест сам сдвигает время, зовёт грозу к игроку и прогоняет Стража по фазам (только в Studio, в игре выключен).
6. **Публиковать** можно: всё видимое этапа 4 — только у игроков с `WorldAccess` (тестеры при `WorldEnabled = false`), старая игра выглядит как раньше.

## На телефоне (с тестером, ~25 минут)

- За 24 минуты: рассвет → день → закат → ночь (созвездия, сияние на севере, светлячки) → предрассвет; хотя бы одна гроза (стена туч, молнии, дождь, после — радуга).
- **Кит у обоих в одном месте:** встать рядом с одним китом и сверить по скриншотам (или `whale tp 1` у обоих).
- Встать на спину кита (`whale tp 3`) — везёт, не сбрасывает. Сад и страница летописи на «Старом ките».
- Прыгнуть на медузу — подбрасывает, +1 деление света.
- Страж: `guardian wake` — сцена-знакомство (пропуск касанием), полоса здоровья, все атаки видно заранее; втроём победить → «Страж повержен» + награды; через 10 минут он вернётся.
- Кадры/с: от 30 на телефоне в грозе и в бою со Стражем.

## Проверки вне Studio (для следующих правок)

```
bash nimby/stage4/tests/run.sh          # чистая логика (нужен luau)
bash nimby/tools/analyze.sh             # luau-lsp + типы Roblox + заглушки контрактов
bash nimby/tools/analyze-strict.sh      # строгий проход: опечатки в свойствах/Enum
node nimby/tools/build-install.mjs      # пересобрать install.luau после правок
```

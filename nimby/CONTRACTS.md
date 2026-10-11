# «Нимбы» — договорённости этапа 4 «Живой мир»

Основа — факты из плейса «Тест нимбуса» (placeId 82864131361405) на 11.10.2026: этапы 0–3 сделаны. Здесь описано только то, что добавляет этап 4, и чужие API, на которые он опирается. Код этапов 0–3 сюда не выкладывается.

## 1. Что добавляет этап 4 (только новые экземпляры)

```
ReplicatedStorage.Archipelago
  WorldMath         ModuleScript  чистая математика: сутки, погода, фронт грозы, шум (её же гоняют тесты)
  WorldClock        ModuleScript  время мира и погода по атрибутам WorldState (сервер и клиент)
  WorldFX           ModuleScript  только клиент: доступ к миру, тряска, вспышка, звук, кольца, толчок
  Config/WeatherCycle  ModuleScript  веса погоды, фронт, молнии, дождь/метель, свет погоды
  Config/Night         ModuleScript  часы фаз, свет суток, светлячки, окна, созвездия, сияние, закатный остров
  Config/Life          ModuleScript  киты (маршруты), медузы (стайки), птицы
  Config/Ambience      ModuleScript  все звуки этапа 4 (0 = «найти в Studio»), зоны, ветер
  Config/Guardian      ModuleScript  Страж: арена, здоровье, фазы, атаки, награда, звуки
  Movers/Route         ModuleScript  замкнутая кривая Катмулла — Рома с равномерной скоростью
  Movers/Whales        ModuleScript  место и поворот кита по времени сервера
  Movers/Jellies       ModuleScript  место медузы по времени сервера
  Assets/WhaleBuilder     ModuleScript  модель кита кодом (+ сад на спине у «Старого кита»)
  Assets/JellyBuilder     ModuleScript  модель медузы кодом
  Assets/GuardianBuilder  ModuleScript  видимая модель Стража кодом + скелет для анимации
  Remotes/Weather, Remotes/Creatures, Remotes/Guardian   RemoteEvent (создаёт сервер, если их нет)
  WorldState        (папка уже есть) — атрибуты пишут только серверные скрипты этапа 4

ServerScriptService.Archipelago
  WorldBus          ModuleScript  BindableFunction в ServerStorage.ArchWorldBus (панель, проверка)
  Stage4Progress    ModuleScript  переходник к Progress (косметика, осколок, страница, «встретил Стража»)
  DayNightServer    Script
  WeatherServer     Script
  CreaturesServer   Script        медузы (+1 свет), секрет на ките, телепорт на кита
  GuardianServer    Script
  Stage4Check       Script        только в Studio: проверки → атрибуты игрока Stage4_*

StarterPlayerScripts.Archipelago
  NightClient  WeatherClient  CreaturesClient  BirdsClient  AmbientClient  GuardianClient   LocalScript

Workspace (создаётся в игре)
  Archipelago.Guardian/TempleGuardian   хитбокс Стража (сервер), Humanoid, Zone = "World"
  Archipelago.Guardian/Arena            запасная арена, только если нет детали с тегом ArchGuardianArena
  ArchLocal                             папка только у игрока: киты, медузы, птицы, гроза, небо, Страж-вид
SoundService.World                      SoundGroup (создаёт клиент), сюда все звуки мира
ServerStorage.ArchWorldBus              BindableFunction: Day, Weather, Creatures, Guardian
ServerStorage.ArchSunsetHidden          куда прячется закатный остров вне заката
```

Существующие скрипты меняются только патчем: `stage4/patches/DevPanelServer.md`.

## 2. Атрибуты WorldState (пишет только сервер)

| Атрибут | Тип | Кто пишет | Смысл |
|---|---|---|---|
| `DayEpoch` | number | DayNightServer | время сервера (`GetServerTimeNow`), с которого считается цикл |
| `DayOffset` | number | DayNightServer | сдвиг цикла в секундах (панель: `time <час>`) |
| `DayLength` | number | DayNightServer | длина суток, с (= сумма `Config.Day.PHASES`, 1440) |
| `DayPhase` | string | DayNightServer | `dawn` / `day` / `sunset` / `night` / `predawn` |
| `DayClock` | number | DayNightServer | часы 0–24, раз в 1 с, только для чтения людьми и проверками |
| `SunsetIsland` | boolean | DayNightServer | закатный остров виден (false → игроки растворяют его, через 3,5 с сервер прячет) |
| `Weather` | string | WeatherServer | `clear` / `cloudy` / `storm` / `rain` / `rainbow` |
| `WeatherPrev` | string | WeatherServer | предыдущая погода (плавный выход из облачности) |
| `WeatherT0`, `WeatherT1` | number | WeatherServer | начало и конец текущей погоды (время сервера) |
| `WeatherVer` | number | WeatherServer | растёт при каждой смене — клиенты сбрасывают кэш |
| `StormT0` | number | WeatherServer | начало фронта; центр фронта в этот момент = `StormFrom` |
| `StormT1` | number | WeatherServer | конец грозы (дальше — «дождь стихает», без молний) |
| `StormEnd` | number | WeatherServer | конец дождя; после — фронта нет |
| `StormFrom` | Vector3 | WeatherServer | центр фронта в `StormT0` (Y = ORIGIN.Y) |
| `StormDir` | Vector3 | WeatherServer | единичное направление движения (по XZ) |
| `StormSpeed`, `StormWidth`, `StormDepth` | number | WeatherServer | стад/с, ширина поперёк хода, глубина вдоль хода |
| `StormSeed` | number | WeatherServer | зерно (дрожь течений, рисунок облаков) |

Место кита и медуз в WorldState не пишется: они считаются от `workspace:GetServerTimeNow()` одной формулой у сервера и у всех игроков (`Movers/Whales`, `Movers/Jellies`). Поэтому кит у всех в одной точке без сети.

Фронт грозы, сутки и дрожь течений тоже считаются формулой из атрибутов (`WorldClock`).

### Атрибуты модели Стража (`Workspace.Archipelago.Guardian.TempleGuardian`, пишет GuardianServer)

`Zone = "World"`, `GState` (`dormant`/`intro`/`fight`/`transition`/`dead`), `GPhase` (1–3), `GInvuln`, `GFrozen`, `GMaxHp`,
`GArena` (Vector3, центр пола), `GFloor`, `GRadius`, `GIntroT0`, `GTransT0`, `GDeathT`, `GRespawnAt`,
текущая атака: `GAct` (`slam`/`sweep`/`quake`/`beams`/`rubble`/""), `GActT0` (начало замаха, время сервера), `GActTarget`,
`GActDir` (поворот в момент начала, рад), `GActSeed`, `GActCount`/`GActSign` (лучи), `GActN` — счётчик, меняется последним
(клиент по нему начинает показ). Всё время — `GetServerTimeNow`, длительности — `Config.Guardian.ATTACKS`.

Атрибуты игрока: `ArchGuardianMet` (сервер, после 6 с у Стража); награды — через `Stage4Progress` (`shards`, `lore`, `cosmetics`, `flags`).

## 3. Свет — только через LightingDirector

| Слой | Приоритет (`Config.Sky.LAYERS`) | Кто ведёт | Что пишет |
|---|---|---|---|
| `daynight` | 10 | NightClient | `Lighting.ClockTime`, `Brightness`, `Ambient`, `OutdoorAmbient`, `ColorShift_Top`, `ExposureCompensation`, `Atmosphere.*`, `Bloom.Intensity`, `SunRays.Intensity` |
| `weather` | 30 | WeatherClient | `Lighting.Brightness`, `OutdoorAmbient`, `Atmosphere.*`, `Grade.Saturation/Contrast/Brightness`, вспышки молний |
| `fx` | 25 (неизвестный слой) | WorldFX.flash | короткие вспышки и тинт: `Grade.TintColor`, `Grade.Brightness` |

- `Lighting.ClockTime` на клиенте пишет только слой `daynight`. Напрямую — никто из этапа 4.
- `Grade.TintColor` не пишут ни `daynight`, ни `weather` — он свободен для вспышек `fx` (тинт при ударе Стража, молнии рядом).
- Игрок без `WorldAccess`: слои `daynight` и `weather` получают вес 0 → старая игра выглядит как раньше. Серверный `Lighting` этап 4 не трогает.

## 4. Кто «в мире» (клиент)

`WorldFX.inWorld()` = `WorldAccess == true` и (`FlightShared.cloudReturn(LocalPlayer)` если он есть, иначе `Zone == "World"` и нет `InDuel` / `NimbusInMatch` / `NimbusInRoulette`). Всё видимое этапа 4 (дождь, киты, птицы, Страж-вид, звуки) показывается только тем, кто в мире. Кэш — 0,5 с.

Сервер: `WorldBus.inWorld(plr)` — то же через `FlightShared.cloudReturn(plr)`.

## 5. Сеть

| RemoteEvent | Направление | Сообщения |
|---|---|---|
| `Remotes.Weather` | сервер → все | `("strike", pos: Vector3, groundY: number, tStrike: number, seed: number)` — молния; клиент рисует предупреждение до `tStrike` |
| | сервер → игрок | `("knock", v: Vector3)` — толчок от молнии |
| `Remotes.Creatures` | игрок → сервер | `("jelly", group: number, index: number)` — прыжок на медузу; сервер сверяет место медузы по времени (≤ `Life.JELLY.CHECK_RADIUS`) и откат, +1 `ArchLight` с потолком `ArchLightMax` |
| | игрок → сервер | `("whaleSecret")` — касание страницы в саду на ките; сервер сверяет расстояние до сада по времени |
| | сервер → игрок | `("jellyOk", group, index, light)` / `("secretOk", id)` |
| `Remotes.Guardian` | сервер → все | `("rubble", spots: {Vector3}, tFall: number)` — точки камнепада |
| | сервер → игрок | `("knock", v: Vector3)`, `("hit", amount)` — красная вспышка, `("reward", list)` |

Частота запросов игрока: медуза — не чаще 1 раза в 0,4 с на игрока и 1 раза в `Life.JELLY.COOLDOWN` с на одну медузу.

## 6. Крылья, толчки, урон

- Сбить крылья (молния, Страж): сервер ставит на персонажа `FlightStunUntil = GetServerTimeNow() + Flight.HIT_FOLD_TIME` и `FlightStunWhy = "lightning" | "guardian"`. FlightClient сам рассыпает крылья.
- Толчок: сервер шлёт игроку `("knock", v)`, клиент вызывает `WorldFX.knock(v)`. В полёте (`FlightState == "Wings"`) `WorldFX.knock` дополнительно ставит локальные `FlightKnock` (Vector3) и `FlightKnockT` (время сервера) — **TODO(studio): сверить формат с FlightClient**; если он их не читает или ждёт другое — выключить `WorldFX.USE_FLIGHT_KNOCK`.
- Урон Стража — только `require(ServerStorage.HaloHooks).damage(humanoid, amount, guardianModel)`. `hum:TakeDamage` не вызывается.
- Страж уважает `Hooks.worldFrozen` (стоит, ждущие удары и камни гаснут), `Hooks.voidWorld` (не возрождается), бьёт копии из `Hooks.decoys` как игроков, не выбирает целью игроков с `Hooks.canAttack(plr) == false`.

## 7. Теги CollectionService (ставит этап 5, этап 4 их понимает)

| Тег | На чём | Что делает |
|---|---|---|
| `ArchSunsetOnly` | Model / BasePart | виден и касаем только в фазе `sunset` (сервер прячет в `ServerStorage.ArchSunsetHidden`) |
| `ArchLightningRod` | BasePart | громоотвод: молния бьёт в верх детали |
| `ArchNightGlow` | BasePart | ночью светится: Neon + цвет `GlowColor` (атрибут, по умолчанию тёплый) |
| `ArchNightLight` | PointLight / SpotLight / SurfaceLight | ночью включается, днём гаснет |
| `ArchFireflies` | BasePart | ночью над деталью кружат светлячки (кроме того, сами — над островами Луга и Корней) |
| `ArchAmbientZone` | BasePart | звуковая зона: атрибуты `SoundId`, `Volume`, `Radius`, `Night` (true = только ночью) |
| `ArchGuardianArena` | BasePart | центр арены Стража (верх детали = пол), атрибут `Radius` |

## 8. Шина для панели и проверки (ServerStorage.ArchWorldBus)

| BindableFunction | Команды `:Invoke(cmd, ...)` |
|---|---|
| `Day` | `("hour", h)`, `("phase", name)`, `("info")` |
| `Weather` | `("set", state, pos?)` — `storm` с `pos` ведёт фронт через `pos` (дойдёт ≈ за 20 с), `("info")` |
| `Creatures` | `("whaleTp", plr, n?)` — поставить на спину кита n (1–3), `("info")` |
| `Guardian` | `("spawn")`, `("reset")`, `("kill")`, `("info")` |

## 9. Правила совместимости (повтор из плейса)

- Клавиши этапу 4 не нужны. Не занимать: Shift, левый Ctrl, Q, X, E R F G T Z C V B H Y N.
- `FieldOfView`, `Humanoid.CameraOffset`, `WalkSpeed` этап 4 не трогает. Тряска — поворотом `Camera.CFrame` после камеры (`BindToRenderStep`, приоритет Camera + 2), с учётом «Уменьшить движение».
- Сцена-знакомство со Стражем — единственное место, где этап 4 берёт камеру (`Scriptable` ≤ 5 с, пропуск касанием), и только если игрок не в бою/полёте.
- Суставы — `AnimationConstraint` или `Motor6D`: этап 4 персонажей не анимирует.
- Плохие ID звуков: 0 = звука нет, место помечено «найти в Studio» в `Config.Ambience` / `Config.Guardian.SND`.

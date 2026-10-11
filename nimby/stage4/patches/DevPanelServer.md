# Патч DevPanelServer (этап 4)

Существующий скрипт `ServerScriptService.Archipelago.DevPanelServer` **не переписывать целиком** — только три точечные вставки.
Перед правкой — бэкап `ServerStorage.Backup_DevPanelServer_<ДДММ>`.

Имена переменных ниже (`plr`, `cmd`, `arg`, `arg2`, `reply`) — **как в соседних ветках `elseif cmd == ...`** этого скрипта: подставь их настоящие имена.

## 1. Помощник шины — вставить после строк с `require` в начале файла

```lua
-- этап 4: команды мира через ServerStorage.ArchWorldBus (DayNight/Weather/Creatures/GuardianServer)
local function worldBus(name, ...)
	local f = game:GetService("ServerStorage"):FindFirstChild("ArchWorldBus")
	local b = f and f:FindFirstChild(name)
	if not b then
		return false, "нет шины " .. name
	end
	local ok, a, b2 = pcall(b.Invoke, b, ...)
	if not ok then
		return false, tostring(a)
	end
	return a, b2
end
```

## 2. Ветка `time` — заменить строку, которая пишет `Lighting.ClockTime = …`

Найти в ветке `elseif cmd == "time" then` строку вида `Lighting.ClockTime = <час>` (или `game.Lighting.ClockTime = …`) и заменить её на:

```lua
worldBus("Day", "hour", tonumber(arg)) -- этап 4: сдвиг суток в WorldState (иначе слой daynight затрёт)
```

## 3. Новые команды — вставить сразу после конца ветки `time` (перед следующим `elseif`)

```lua
elseif cmd == "phase" then
	-- phase <dawn|day|sunset|night|predawn>
	reply(plr, worldBus("Day", "phase", arg))
elseif cmd == "weather" then
	-- weather <clear|cloudy|storm|rain|rainbow>; storm ведёт фронт к игроку (≈ 20 с)
	local hrp = plr.Character and plr.Character:FindFirstChild("HumanoidRootPart")
	reply(plr, worldBus("Weather", "set", arg, hrp and hrp.Position or nil))
elseif cmd == "guardian" then
	-- guardian <spawn|reset|wake|kill>
	reply(plr, worldBus("Guardian", arg))
elseif cmd == "whale" then
	-- whale tp [1–3]
	if arg == "tp" then
		reply(plr, worldBus("Creatures", "whaleTp", plr, tonumber(arg2) or 1))
	end
```

Если `reply` в скрипте нет (ответ не отправляется) — просто вызвать `worldBus(...)` без `reply(...)`.

## 4. Кнопки на телефоне (DevPanelClient), если команды там заданы списком

Добавить в список команд/кнопок: `time 6`, `time 18`, `time 0`, `weather storm`, `weather clear`, `weather rainbow`, `guardian wake`, `guardian reset`, `guardian kill`, `whale tp 1`, `whale tp 3`.

## Проверка

В Play: `time 18` → небо закатное, через 2 с появляется закатный остров (если есть деталь с тегом `ArchSunsetOnly`); `weather storm` → через ~20 с над игроком гроза; `guardian wake` → Страж встаёт; `whale tp 3` → стоишь на спине «Старого кита», он везёт.

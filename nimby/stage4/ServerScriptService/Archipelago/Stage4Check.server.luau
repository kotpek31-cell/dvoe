--!nonstrict
-- Stage4Check — проверка этапа 4 одним Play-тестом (ТОЛЬКО в Studio, в игре сразу выходит).
-- Итог — в атрибутах первого игрока: Stage4_Day, Stage4_Weather, Stage4_Whale, Stage4_Guardian
-- (строка «OK …» или «FAIL …»), Stage4_OK (true/false), Stage4_Report, Stage4_Done.
-- Прочитать в Studio одним запросом: game.Players:GetPlayers()[1]:GetAttributes().
-- Внимание: тест сдвигает время суток, зовёт грозу к игроку и прогоняет Стража по фазам.

local RunService = game:GetService("RunService")
if not RunService:IsStudio() then
	return
end

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")
local CollectionService = game:GetService("CollectionService")

local Arch = ReplicatedStorage:WaitForChild("Archipelago")
local State = Arch:WaitForChild("WorldState")
local Clock = require(Arch:WaitForChild("WorldClock"))
local WorldMath = require(Arch:WaitForChild("WorldMath"))
local Night = require(Arch.Config:WaitForChild("Night"))
local WC = require(Arch.Config:WaitForChild("WeatherCycle"))
local GCfg = require(Arch.Config:WaitForChild("Guardian"))
local Whales = require(Arch:WaitForChild("Movers"):WaitForChild("Whales"))
local Bus = require(script.Parent:WaitForChild("WorldBus"))

local plr = Players:GetPlayers()[1] or Players.PlayerAdded:Wait()
task.wait(8) -- системы успели запуститься

local results = {}
local function report(key: string, ok: boolean, text: string)
	local line = (ok and "OK " or "FAIL ") .. text
	results[key] = ok
	plr:SetAttribute("Stage4_" .. key, line)
	print("[Stage4Check] " .. key .. ": " .. line)
end

local function safe(fn)
	local ok, a, b = pcall(fn)
	if not ok then
		return false, "ошибка: " .. tostring(a)
	end
	return a, b
end

-- ===== сутки =====
report("Day", safe(function()
	local info = Bus.call("Day", 5, "info")
	if type(info) ~= "table" then
		return false, "нет шины Day (DayNightServer не запущен?)"
	end
	if Clock.LENGTH ~= 1440 then
		return false, "длина суток " .. Clock.LENGTH .. " ≠ 1440"
	end
	for _, k in ipairs({ "DayEpoch", "DayOffset", "DayLength", "DayPhase", "DayClock" }) do
		if State:GetAttribute(k) == nil then
			return false, "нет WorldState." .. k
		end
	end
	-- все фазы по кругу и закатный остров
	local seen = {}
	for c = 0, Clock.LENGTH - 1, 5 do
		local _, name = WorldMath.dayAt(c, Clock.PHASES, Night.CLOCK)
		seen[name] = true
	end
	for _, n in ipairs({ "dawn", "day", "sunset", "night", "predawn" }) do
		if not seen[n] then
			return false, "в цикле нет фазы " .. n
		end
	end
	local oldOffset = State:GetAttribute("DayOffset")
	local probe = Instance.new("Part")
	probe.Name = "Stage4SunsetProbe"
	probe.Anchored = true
	probe.Transparency = 1
	probe.CanCollide = false
	probe.Position = Clock.ORIGIN + Vector3.new(0, -2000, 0)
	probe.Parent = workspace
	CollectionService:AddTag(probe, "ArchSunsetOnly")
	Bus.call("Day", 5, "hour", 12)
	task.wait(Night.SUNSET.FADE + 1.5) -- прячется после растворения
	local hiddenAtNoon = probe.Parent ~= nil and not probe:IsDescendantOf(workspace)
	local ok18, at18 = Bus.call("Day", 5, "hour", 18)
	task.wait(1.5)
	local shownAtSunset = probe:IsDescendantOf(workspace)
	-- вернуть
	CollectionService:RemoveTag(probe, "ArchSunsetOnly")
	probe:Destroy()
	State:SetAttribute("DayOffset", oldOffset)
	if not ok18 or type(at18) ~= "table" or at18.phase ~= "sunset" then
		return false, "time 18 ≠ sunset"
	end
	if not hiddenAtNoon or not shownAtSunset then
		return false, "закатный остров: днём спрятан=" .. tostring(hiddenAtNoon) .. ", на закате виден=" .. tostring(shownAtSunset)
	end
	return true, string.format("сутки 24 мин, 5 фаз, time→ClockTime, закатный остров ок (сейчас %s %.1f ч)", info.phase, info.clock)
end))

-- ===== погода =====
report("Weather", safe(function()
	local info = Bus.call("Weather", 5, "info")
	if type(info) ~= "table" then
		return false, "нет шины Weather"
	end
	local hrp = plr.Character and plr.Character:FindFirstChild("HumanoidRootPart")
	local pos = hrp and hrp.Position or Clock.ORIGIN
	local ok = Bus.call("Weather", 5, "set", "storm", pos)
	if not ok then
		return false, "weather storm не сработал"
	end
	task.wait(0.5)
	if State:GetAttribute("Weather") ~= "storm" then
		return false, "Weather ≠ storm"
	end
	local f = Clock.front()
	if not f then
		return false, "фронт не записан в WorldState"
	end
	local arrive = State:GetAttribute("StormT0") + WC.FRONT.DEV_ARRIVE + 30
	local I = Clock.stormAt(pos, arrive)
	local inForge = Clock.regionAt(pos) == "forge"
	if not inForge and I < 0.5 then
		return false, string.format("гроза не дойдёт до игрока (сила %.2f)", I)
	end
	local j = Clock.jitter(arrive)
	-- путь не задевает исключённые зоны
	local bad = 0
	for _, p in ipairs(WorldMath.frontSamples(f, 16, 3)) do
		if Clock.inExclusion(Vector3.new(p[1], Clock.ORIGIN.Y, p[2])) then
			bad += 1
		end
	end
	local struck = Bus.call("Weather", 5, "strike", pos + Vector3.new(120, 0, 0))
	return true, string.format("гроза к игроку: сила %.2f, дрожь течений %.2f, молния %s, точек в зонах режимов %d (гроза оставлена — смотреть)", I, j, tostring(struck), bad)
end))

-- ===== киты =====
report("Whale", safe(function()
	local info = Bus.call("Creatures", 5, "info")
	if type(info) ~= "table" then
		return false, "нет шины Creatures"
	end
	if #info.whales ~= 3 then
		return false, "китов " .. #info.whales
	end
	local notes = {}
	for _, a in ipairs(info.audit) do
		if not a.lengthOk or not a.periodOk then
			return false, string.format("кит %s: длина %d, круг %d с", a.id, a.length, a.period)
		end
		if a.exclusionHits > 0 then
			return false, string.format("кит %s заходит в зоны режимов (%d точек)", a.id, a.exclusionHits)
		end
		table.insert(notes, string.format("%s %d/%dс", a.id, a.length, a.period))
	end
	-- одна формула = одно место: шина (CreaturesServer) и этот скрипт считают одинаково
	local T = workspace:GetServerTimeNow() + 1.234
	local p1 = Bus.call("Creatures", 5, "whaleAt", 2, T)
	local p2 = Whales.headAt(Whales.list[2], T)
	if typeof(p1) ~= "Vector3" or (p1 - p2).Magnitude > 0.01 then
		return false, "место кита расходится"
	end
	return true, "3 кита: " .. table.concat(notes, ", ") .. "; место по времени совпадает"
end))

-- ===== Страж =====
report("Guardian", safe(function()
	local okHooks, Hooks = pcall(function()
		return require(ServerStorage:WaitForChild("HaloHooks", 5))
	end)
	if not okHooks or type(Hooks) ~= "table" or type(Hooks.damage) ~= "function" then
		return false, "нет HaloHooks.damage"
	end
	local info = Bus.call("Guardian", 5, "info")
	if type(info) ~= "table" then
		return false, "нет шины Guardian"
	end
	if not info.model or not info.hasHumanoid or info.zone ~= "World" then
		return false, "модель/Humanoid/Zone"
	end
	Bus.call("Guardian", 5, "reset")
	task.wait(0.3)
	Bus.call("Guardian", 5, "wake")
	task.wait(GCfg.INTRO + 0.6)
	info = Bus.call("Guardian", 5, "info")
	if info.state ~= "fight" then
		return false, "после пробуждения состояние " .. tostring(info.state)
	end
	local model = workspace.Archipelago.Guardian:FindFirstChild("TempleGuardian")
	local hum = model and model:FindFirstChildOfClass("Humanoid")
	if not hum then
		return false, "нет Humanoid"
	end
	-- удар по Стражу через HaloHooks (как способность); если не прошёл — напрямую (проверяем логику фаз)
	local before = hum.Health
	pcall(Hooks.damage, hum, 1, workspace)
	task.wait(0.2)
	local hooksHit = hum.Health < before
	hum.Health = hum.MaxHealth * 0.5
	task.wait(0.4)
	info = Bus.call("Guardian", 5, "info")
	if info.state ~= "transition" then
		return false, "на 50% нет перехода (" .. tostring(info.state) .. ")"
	end
	task.wait(GCfg.TRANSITION + 0.5)
	info = Bus.call("Guardian", 5, "info")
	if info.phase ~= 2 then
		return false, "фаза после перехода " .. tostring(info.phase)
	end
	hum = model:FindFirstChildOfClass("Humanoid")
	hum.Health = hum.MaxHealth * 0.1
	task.wait(GCfg.TRANSITION + 0.9)
	info = Bus.call("Guardian", 5, "info")
	if info.phase ~= 3 then
		return false, "третья фаза не началась (" .. tostring(info.phase) .. ")"
	end
	hum = model:FindFirstChildOfClass("Humanoid")
	hum.Health = 0
	task.wait(0.5)
	info = Bus.call("Guardian", 5, "info")
	if info.state ~= "dead" then
		return false, "не умер (" .. tostring(info.state) .. ")"
	end
	Bus.call("Guardian", 5, "spawn")
	task.wait(0.5)
	info = Bus.call("Guardian", 5, "info")
	if info.state ~= "dormant" or info.health ~= info.maxHealth then
		return false, "не возродился (" .. tostring(info.state) .. ")"
	end
	return true, "пробуждение → бой, фазы 1→2→3, смерть, возрождение; HaloHooks.damage по Стражу: " .. (hooksHit and "проходит" or "НЕ проходит (проверить зоны Hooks)")
end))

local all = results.Day and results.Weather and results.Whale and results.Guardian
plr:SetAttribute("Stage4_OK", all == true)
local parts = {}
for _, k in ipairs({ "Day", "Weather", "Whale", "Guardian" }) do
	table.insert(parts, k .. "=" .. (results[k] and "ok" or "FAIL"))
end
plr:SetAttribute("Stage4_Report", table.concat(parts, " "))
plr:SetAttribute("Stage4_Done", true)
print("[Stage4Check] ИТОГ: " .. table.concat(parts, " "))

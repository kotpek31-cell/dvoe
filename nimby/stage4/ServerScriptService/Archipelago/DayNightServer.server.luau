--!nonstrict
-- DayNightServer — сутки мира (24 мин, фазы из Config.Day.PHASES).
-- Пишет WorldState: DayEpoch, DayOffset, DayLength, DayPhase, DayClock. Lighting на сервере НЕ трогает:
-- свет суток — клиентский слой daynight (NightClient) через LightingDirector.
-- Закатный остров (тег ArchSunsetOnly): виден только в фазе sunset, остальное время лежит в ServerStorage.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")
local CollectionService = game:GetService("CollectionService")

local Arch = ReplicatedStorage:WaitForChild("Archipelago")
local State = Arch:WaitForChild("WorldState")
local Night = require(Arch.Config:WaitForChild("Night"))
local Clock = require(Arch:WaitForChild("WorldClock"))
local WorldMath = require(Arch:WaitForChild("WorldMath"))
local Bus = require(script.Parent:WaitForChild("WorldBus"))

local L = Clock.LENGTH

-- старт: начало START_PHASE прямо сейчас
local now = workspace:GetServerTimeNow()
local startAt = WorldMath.phaseStart(Night.START_PHASE or "day", Clock.PHASES)
State:SetAttribute("DayLength", L)
State:SetAttribute("DayOffset", 0)
State:SetAttribute("DayEpoch", now - startAt)

-- ===== закатный остров =====

local hiddenFolder = ServerStorage:FindFirstChild(Night.SUNSET.HIDDEN_FOLDER)
if not hiddenFolder then
	hiddenFolder = Instance.new("Folder")
	hiddenFolder.Name = Night.SUNSET.HIDDEN_FOLDER
	hiddenFolder.Parent = ServerStorage
end

local homeOf = {} -- [inst] = родитель в Workspace
local sunsetVisible = nil

local function placeSunset(inst: Instance, visible: boolean)
	local home = homeOf[inst]
	if not home then
		return
	end
	if visible then
		if inst.Parent ~= home then
			inst.Parent = home
		end
	elseif inst.Parent ~= hiddenFolder then
		inst.Parent = hiddenFolder
	end
end

local function track(inst: Instance)
	if homeOf[inst] then
		return
	end
	if not inst:IsDescendantOf(workspace) then
		return
	end
	homeOf[inst] = inst.Parent
	inst:SetAttribute("SunsetOnly", true)
	placeSunset(inst, sunsetVisible == true)
end

for _, inst in ipairs(CollectionService:GetTagged("ArchSunsetOnly")) do
	track(inst)
end
CollectionService:GetInstanceAddedSignal("ArchSunsetOnly"):Connect(track)
CollectionService:GetInstanceRemovedSignal("ArchSunsetOnly"):Connect(function(inst)
	homeOf[inst] = nil
end)

local function setSunsetVisible(v: boolean)
	if sunsetVisible == v then
		return
	end
	local first = sunsetVisible == nil
	sunsetVisible = v
	State:SetAttribute("SunsetIsland", v)
	local function apply()
		if sunsetVisible ~= v then
			return
		end
		for inst in pairs(homeOf) do
			if inst.Parent then
				placeSunset(inst, v)
			end
		end
	end
	if v or first then
		apply()
	else
		-- игроки успевают растворить остров (NightClient), потом прячем
		task.delay(Night.SUNSET.FADE, apply)
	end
end

-- ===== ход суток =====

local lastPhase = nil
local function tick()
	local info = Clock.day()
	if info.phase ~= lastPhase then
		lastPhase = info.phase
		State:SetAttribute("DayPhase", info.phase)
	end
	State:SetAttribute("DayClock", math.floor(info.clock * 100 + 0.5) / 100)
	setSunsetVisible(info.phase == "sunset")
end

-- ===== шина: панель разработчика и проверка =====

local function setCycle(target: number)
	local t = workspace:GetServerTimeNow()
	local epoch = State:GetAttribute("DayEpoch") or 0
	local raw = (t - epoch) % L
	State:SetAttribute("DayOffset", (target - raw) % L)
	tick()
end

Bus.serve("Day", function(cmd, a)
	if cmd == "hour" then
		local h = tonumber(a)
		if not h then
			return false, "нужен час 0–24"
		end
		setCycle((WorldMath.cycleForClock(h, Clock.PHASES, Night.CLOCK)))
		return true, Clock.day()
	elseif cmd == "phase" then
		local found = false
		for _, ph in ipairs(Clock.PHASES) do
			if ph.name == a then
				found = true
			end
		end
		if not found then
			return false, "фазы: dawn day sunset night predawn"
		end
		setCycle(WorldMath.phaseStart(a, Clock.PHASES) + 0.5)
		return true, Clock.day()
	elseif cmd == "info" then
		local info = Clock.day()
		info.length = L
		info.sunsetIsland = sunsetVisible
		local count = 0
		for _ in pairs(homeOf) do
			count += 1
		end
		info.sunsetModels = count
		return info
	end
	return nil
end)

tick()
while true do
	task.wait(1)
	tick()
end

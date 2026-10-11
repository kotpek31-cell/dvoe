--!nonstrict
-- WorldClock — время мира и погода по атрибутам WorldState (пишет только сервер, см. CONTRACTS.md §2).
-- Одинаково считает на сервере и у игроков: сутки, фронт грозы, сила грозы в точке, дрожь течений.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Arch = ReplicatedStorage:WaitForChild("Archipelago")
local ConfigF = Arch:WaitForChild("Config")
local State = Arch:WaitForChild("WorldState")

local WorldMath = require(Arch:WaitForChild("WorldMath"))
local World = require(ConfigF:WaitForChild("World"))
local Day = require(ConfigF:WaitForChild("Day"))
local Weather = require(ConfigF:WaitForChild("Weather"))
local Night = require(ConfigF:WaitForChild("Night"))
local WC = require(ConfigF:WaitForChild("WeatherCycle"))

local Clock = {}
Clock.State = State
Clock.Math = WorldMath

local PHASES, LENGTH = WorldMath.normPhases(Day.PHASES)
Clock.PHASES = PHASES
Clock.LENGTH = LENGTH
Clock.ORIGIN = (typeof(World.ORIGIN) == "Vector3") and World.ORIGIN or Vector3.new(0, 10, 0)

local NO_STORM = Weather.NO_STORM_REGIONS or { forge = true }
local SNOW = Weather.SNOW_REGIONS or { ice = true }
local JITTER = Weather.CURRENT_JITTER or 0.2

function Clock.now(): number
	return workspace:GetServerTimeNow()
end

-- ===== кэш атрибутов =====
local dirty = true
local cache = {}

State.AttributeChanged:Connect(function()
	dirty = true
end)

local function refresh()
	if not dirty then
		return cache
	end
	dirty = false
	cache.epoch = State:GetAttribute("DayEpoch") or 0
	cache.offset = State:GetAttribute("DayOffset") or 0
	cache.weather = State:GetAttribute("Weather") or "clear"
	cache.prev = State:GetAttribute("WeatherPrev") or "clear"
	cache.w0 = State:GetAttribute("WeatherT0") or 0
	cache.w1 = State:GetAttribute("WeatherT1") or 0
	local t0 = State:GetAttribute("StormT0")
	local from = State:GetAttribute("StormFrom")
	local dir = State:GetAttribute("StormDir")
	if typeof(t0) == "number" and typeof(from) == "Vector3" and typeof(dir) == "Vector3" then
		cache.front = {
			x0 = from.X,
			z0 = from.Z,
			dx = dir.X,
			dz = dir.Z,
			speed = State:GetAttribute("StormSpeed") or 18,
			width = State:GetAttribute("StormWidth") or 2800,
			depth = State:GetAttribute("StormDepth") or 1100,
			t0 = t0,
			t1 = State:GetAttribute("StormT1") or t0,
			tEnd = State:GetAttribute("StormEnd") or t0,
			seed = State:GetAttribute("StormSeed") or 0,
			rampIn = WC.FRONT.RAMP_IN,
			top = WC.FRONT.TOP,
			edge = WC.FRONT.EDGE,
		}
	else
		cache.front = nil
	end
	return cache
end

-- ===== сутки =====

-- место в цикле, с (0..LENGTH)
function Clock.cycle(t: number?): number
	local c = refresh()
	return WorldMath.cyclePos(t or Clock.now(), c.epoch, c.offset, LENGTH)
end

-- часы (0–24), фаза, доля фазы, ночь 0–1, закат 0–1, рассвет 0–1
function Clock.day(t: number?)
	local cyc = Clock.cycle(t)
	local clock, phase, p = WorldMath.dayAt(cyc, PHASES, Night.CLOCK)
	return {
		clock = clock,
		phase = phase,
		p = p,
		night = WorldMath.nightFactor(clock),
		sunset = WorldMath.sunsetFactor(clock),
		dawn = WorldMath.dawnFactor(clock),
		cycle = cyc,
	}
end

-- ===== погода =====

function Clock.weather()
	local c = refresh()
	return c.weather, c.w0, c.w1, c.prev
end

-- общая облачность по миру 0–1 (плавно на сменах)
function Clock.overcast(t: number?): number
	t = t or Clock.now()
	local c = refresh()
	local w, t0 = c.weather, c.w0
	if w == "cloudy" then
		local k = WorldMath.smooth(t0, t0 + 25, t)
		if c.prev ~= "clear" then
			k = 1
		end
		-- к концу облачности, если дальше ясно, — не знаем заранее; держим
		return k
	elseif w == "storm" or w == "rain" then
		return 1
	elseif w == "rainbow" then
		return 1 - WorldMath.smooth(t0, t0 + 30, t)
	end
	-- clear
	if c.prev == "cloudy" or c.prev == "rain" then
		return 1 - WorldMath.smooth(t0, t0 + 25, t)
	end
	return 0
end

-- радуга 0–1
function Clock.rainbow(t: number?): number
	t = t or Clock.now()
	local c = refresh()
	if c.weather ~= "rainbow" then
		return 0
	end
	return WorldMath.smooth(c.w0, c.w0 + 12, t) * (1 - WorldMath.smooth(c.w1 - 20, c.w1, t))
end

-- фронт грозы (таблица для WorldMath) или nil
function Clock.front(t: number?)
	local c = refresh()
	local f = c.front
	if not f then
		return nil
	end
	t = t or Clock.now()
	if t >= f.tEnd or t < f.t0 - 1 then
		return nil
	end
	return f
end

-- жизнь фронта 0–1 (по всему миру)
function Clock.stormLife(t: number?): number
	t = t or Clock.now()
	local f = Clock.front(t)
	if not f then
		return 0
	end
	return WorldMath.frontEnvelope(f, t)
end

local function regionAt(pos: Vector3)
	if World.regionAt then
		local ok, r = pcall(World.regionAt, pos)
		if ok then
			return r
		end
	end
	return nil
end
Clock.regionAt = regionAt

local function inExclusion(pos: Vector3): boolean
	if World.inExclusion then
		local ok, r = pcall(World.inExclusion, pos)
		if ok then
			return r == true
		end
	end
	return false
end
Clock.inExclusion = inExclusion

-- сила грозы в точке 0–1, метель ли там, регион.
-- Кузница (NO_STORM_REGIONS) и зоны других режимов (World.EXCLUSION) — всегда 0.
function Clock.stormAt(pos: Vector3, t: number?)
	t = t or Clock.now()
	local f = Clock.front(t)
	if not f then
		return 0, false, nil
	end
	local I = WorldMath.frontIntensity(f, pos.X, pos.Y - Clock.ORIGIN.Y, pos.Z, t)
	if I <= 0 then
		return 0, false, nil
	end
	local region = regionAt(pos)
	if region and NO_STORM[region] then
		return 0, false, region
	end
	if inExclusion(pos) then
		return 0, false, region
	end
	return I, (region ~= nil and SNOW[region] == true), region
end

-- можно ли сейчас бить молниям (гроза, не стихающий дождь)
function Clock.lightningOn(t: number?): boolean
	t = t or Clock.now()
	local f = Clock.front(t)
	return f ~= nil and WorldMath.frontLightning(f, t) > 0
end

-- центр фронта (Vector3 на высоте ORIGIN.Y) и направление
function Clock.frontCenter(t: number?)
	t = t or Clock.now()
	local f = Clock.front(t)
	if not f then
		return nil, nil
	end
	local x, z = WorldMath.frontCenter(f, t)
	return Vector3.new(x, Clock.ORIGIN.Y, z), Vector3.new(f.dx, 0, f.dz)
end

-- множитель скорости течений: 1 ± CURRENT_JITTER в грозу (одинаково у сервера и игроков)
function Clock.jitter(t: number?): number
	t = t or Clock.now()
	local f = Clock.front(t)
	if not f then
		return 1
	end
	return WorldMath.jitter(t, f.seed, JITTER, WorldMath.frontEnvelope(f, t))
end

return Clock

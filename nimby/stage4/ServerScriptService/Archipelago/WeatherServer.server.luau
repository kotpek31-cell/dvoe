--!nonstrict
-- WeatherServer — погода мира: ясно → облачно → гроза (фронт идёт через часть мира) → дождь стихает → радуга.
-- Порядок случайный, с весами (Config.WeatherCycle.WEIGHTS), длительности — Config.Weather.
-- Пишет WorldState (Weather*, Storm*), бьёт молниями (сбивает крылья летящим, толкает стоящих),
-- дрожит течениями (Flows.jitter). Lighting на сервере не трогает.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local CollectionService = game:GetService("CollectionService")
local RunService = game:GetService("RunService")

local Arch = ReplicatedStorage:WaitForChild("Archipelago")
local ConfigF = Arch:WaitForChild("Config")
local State = Arch:WaitForChild("WorldState")
local Weather = require(ConfigF:WaitForChild("Weather"))
local WC = require(ConfigF:WaitForChild("WeatherCycle"))
local Clock = require(Arch:WaitForChild("WorldClock"))
local WorldMath = require(Arch:WaitForChild("WorldMath"))
local Bus = require(script.Parent:WaitForChild("WorldBus"))

local Flows
pcall(function()
	Flows = require(Arch:WaitForChild("Flows", 10))
end)

local remote = Bus.remote("Weather")
local ORIGIN = Clock.ORIGIN
local rng = Random.new(math.floor(workspace:GetServerTimeNow() * 1000) % 2147483647)

local DUR = {
	clear = Weather.CLEAR or { 8, 12 },
	cloudy = Weather.CLOUDY or 4,
	storm = Weather.STORM or { 5, 7 },
	rain = WC.RAIN or 1.5,
	rainbow = Weather.RAINBOW or 2,
}
local NO_STORM = Weather.NO_STORM_REGIONS or { forge = true }

local ver = 0
local current = "clear"
local firstCycle = true

local function now()
	return workspace:GetServerTimeNow()
end

-- ===== фронт =====

local function randRange(r)
	if type(r) == "table" then
		return rng:NextNumber(r[1], r[2])
	end
	return r
end

-- путь годится, если ни одна точка не в зонах других режимов и не в регионах без грозы
local function pathOk(f): boolean
	for _, p in ipairs(WorldMath.frontSamples(f, 16, 3)) do
		local pos = Vector3.new(p[1], ORIGIN.Y, p[2])
		if Clock.inExclusion(pos) then
			return false
		end
		local r = Clock.regionAt(pos)
		if r and NO_STORM[r] then
			return false
		end
	end
	return true
end

-- план фронта: через точку target (или регион по весам). arrive — через сколько секунд центр дойдёт до цели
local function planFront(t0: number, stormSec: number, rainSec: number, target: Vector3?, arrive: number?)
	local F = WC.FRONT
	local best
	for attempt = 1, F.TRIES do
		local aim
		if target then
			aim = target
		else
			local weights = {}
			for k, v in pairs(F.TARGETS) do
				weights[k] = v.w
			end
			local key = WorldMath.pickWeighted(weights, rng:NextNumber())
			local base = ORIGIN + F.TARGETS[key].pos
			aim = base + Vector3.new(rng:NextNumber(-1, 1) * F.SPREAD, 0, rng:NextNumber(-1, 1) * F.SPREAD)
		end
		local ang = rng:NextNumber(0, math.pi * 2)
		local dir = Vector3.new(math.cos(ang), 0, math.sin(ang))
		local speed = randRange(F.SPEED)
		local reach = arrive or stormSec * 0.5 -- к середине грозы фронт над целью
		local from = aim - dir * speed * reach
		local f = {
			x0 = from.X,
			z0 = from.Z,
			dx = dir.X,
			dz = dir.Z,
			speed = speed,
			width = randRange(F.WIDTH),
			depth = randRange(F.DEPTH),
			t0 = t0,
			t1 = t0 + stormSec,
			tEnd = t0 + stormSec + rainSec,
			rampIn = F.RAMP_IN,
			top = F.TOP,
			edge = F.EDGE,
			seed = rng:NextInteger(1, 999),
		}
		best = best or f
		if pathOk(f) then
			best = f
			break
		end
		if attempt == F.TRIES then
			warn("[WeatherServer] путь грозы мимо исключённых зон не найден — сила там гасится маской")
		end
	end
	return best
end

local function writeFront(f)
	State:SetAttribute("StormT0", f.t0)
	State:SetAttribute("StormT1", f.t1)
	State:SetAttribute("StormEnd", f.tEnd)
	State:SetAttribute("StormFrom", Vector3.new(f.x0, ORIGIN.Y, f.z0))
	State:SetAttribute("StormDir", Vector3.new(f.dx, 0, f.dz))
	State:SetAttribute("StormSpeed", f.speed)
	State:SetAttribute("StormWidth", f.width)
	State:SetAttribute("StormDepth", f.depth)
	State:SetAttribute("StormSeed", f.seed)
end

-- ===== смена погоды =====

local function setWeather(name: string, seconds: number)
	local t = now()
	State:SetAttribute("WeatherPrev", current)
	current = name
	State:SetAttribute("Weather", name)
	State:SetAttribute("WeatherT0", t)
	State:SetAttribute("WeatherT1", t + seconds)
	ver += 1
	State:SetAttribute("WeatherVer", ver)
end

local function startStorm(target: Vector3?, arrive: number?)
	local stormSec = WorldMath.duration(DUR.storm, rng:NextNumber())
	local rainSec = WorldMath.duration(DUR.rain, rng:NextNumber())
	local f = planFront(now(), stormSec, rainSec, target, arrive)
	writeFront(f)
	setWeather("storm", stormSec)
end

local function nextOf(name: string): string
	if firstCycle and WC.FIRST_STORM then
		if name == "clear" then
			return "cloudy"
		elseif name == "cloudy" then
			firstCycle = false
			return "storm"
		end
	end
	return WorldMath.pickWeighted(WC.WEIGHTS[name] or { clear = 1 }, rng:NextNumber()) or "clear"
end

local function advance()
	local nxt = nextOf(current)
	if nxt == "storm" then
		startStorm(nil, nil)
	elseif nxt == "rain" then
		-- фронт тот же: стихает до StormEnd
		local tEnd = State:GetAttribute("StormEnd") or (now() + 60)
		setWeather("rain", math.max(5, tEnd - now()))
	else
		setWeather(nxt, WorldMath.duration(DUR[nxt] or 2, rng:NextNumber()))
	end
end

-- старт: короткое ясно (гарантия грозы в первые 24 минуты)
setWeather("clear", (WC.FIRST_CLEAR or 6) * 60)

-- ===== молнии =====

local LZ = WC.LIGHTNING
local nextStrike = 0
local pending = {} -- {t, pos, groundY}

local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Include
local function refreshRayFilter()
	local wa = workspace:FindFirstChild("Archipelago")
	local list = {}
	if wa then
		local islands = wa:FindFirstChild("Islands")
		if islands then
			table.insert(list, islands)
		end
	end
	for _, rod in ipairs(CollectionService:GetTagged("ArchLightningRod")) do
		table.insert(list, rod)
	end
	rayParams.FilterDescendantsInstances = list
end

local function groundBelow(pos: Vector3): number
	local top = Vector3.new(pos.X, pos.Y + 4, pos.Z)
	local seaY = ORIGIN.Y + LZ.SEA_Y
	local hit = workspace:Raycast(top, Vector3.new(0, seaY - top.Y, 0), rayParams)
	if hit then
		return hit.Position.Y
	end
	return seaY
end

-- молния не бьёт в Кузницу, метель (лёд), зоны других режимов
local function strikeAllowed(pos: Vector3): boolean
	local I, snow = Clock.stormAt(pos)
	return I >= LZ.MIN_STORM and not snow
end

local function flyers()
	local list = {}
	for _, plr in ipairs(Players:GetPlayers()) do
		if Bus.inWorld(plr) then
			local hrp, _, char = Bus.body(plr)
			if hrp and char:GetAttribute("FlightState") == "Wings" and strikeAllowed(hrp.Position) then
				table.insert(list, hrp.Position)
			end
		end
	end
	return list
end

local function pickStrike(): Vector3?
	-- 1) рядом с летящим игроком внутри грозы
	if rng:NextNumber() < LZ.NEAR_FLYER then
		local fl = flyers()
		if #fl > 0 then
			local p = fl[rng:NextInteger(1, #fl)]
			local a = rng:NextNumber(0, math.pi * 2)
			local d = rng:NextNumber(LZ.NEAR_DIST[1], LZ.NEAR_DIST[2])
			local pos = p + Vector3.new(math.cos(a) * d, rng:NextNumber(-12, 12), math.sin(a) * d)
			if strikeAllowed(pos) then
				return pos
			end
		end
	end
	-- 2) громоотвод внутри фронта (выше — вероятнее)
	local rods = {}
	local total = 0
	for _, rod in ipairs(CollectionService:GetTagged("ArchLightningRod")) do
		if rod:IsA("BasePart") and rod:IsDescendantOf(workspace) then
			local top = rod.Position + Vector3.new(0, rod.Size.Y * 0.5, 0)
			if strikeAllowed(top) then
				local w = 1 + math.max(0, top.Y - ORIGIN.Y) / 200
				table.insert(rods, { top, w })
				total += w
			end
		end
	end
	if #rods > 0 and rng:NextNumber() < 0.6 then
		local x = rng:NextNumber() * total
		for _, r in ipairs(rods) do
			x -= r[2]
			if x <= 0 then
				return r[1]
			end
		end
		return rods[#rods][1]
	end
	-- 3) случайная точка во фронте → в землю под ней
	local f = Clock.front()
	if not f then
		return nil
	end
	local cx, cz = WorldMath.frontCenter(f, now())
	for _ = 1, 6 do
		local u = rng:NextNumber(-0.5, 0.5) * f.depth
		local v = rng:NextNumber(-0.5, 0.5) * f.width
		local x = cx + f.dx * u - f.dz * v
		local z = cz + f.dz * u + f.dx * v
		local probe = Vector3.new(x, ORIGIN.Y + 1400, z)
		local gy = groundBelow(probe)
		local pos = Vector3.new(x, gy, z)
		if strikeAllowed(pos) then
			return pos
		end
	end
	return nil
end

local function scheduleStrike()
	local pos = pickStrike()
	if not pos then
		return
	end
	local gy = groundBelow(pos)
	local tStrike = now() + LZ.TELEGRAPH
	local seed = rng:NextInteger(1, 1e6)
	table.insert(pending, { t = tStrike, pos = pos, groundY = gy })
	remote:FireAllClients("strike", pos, gy, tStrike, seed)
end

-- расстояние до вертикального столба молнии (от земли до тучи)
local function boltDist(p: Vector3, s): number
	local top = s.pos.Y + LZ.BOLT_HEIGHT
	local y = math.clamp(p.Y, s.groundY, top)
	local dx, dz = p.X - s.pos.X, p.Z - s.pos.Z
	local dy = p.Y - y
	return math.sqrt(dx * dx + dy * dy + dz * dz)
end

local function resolveStrike(s)
	for _, plr in ipairs(Players:GetPlayers()) do
		if Bus.inWorld(plr) then
			local hrp, _, char = Bus.body(plr)
			if hrp then
				local d = boltDist(hrp.Position, s)
				local flying = char:GetAttribute("FlightState") == "Wings"
				if flying and d <= LZ.STUN_RADIUS then
					Bus.foldWings(char, LZ.WHY)
					local away = Vector3.new(hrp.Position.X - s.pos.X, 0, hrp.Position.Z - s.pos.Z)
					away = (away.Magnitude > 0.1) and away.Unit or Vector3.new(1, 0, 0)
					remote:FireClient(plr, "knock", away * LZ.KNOCK + Vector3.new(0, LZ.KNOCK * 0.4, 0))
				elseif not flying and d <= LZ.KNOCK_RADIUS then
					local away = Vector3.new(hrp.Position.X - s.pos.X, 0, hrp.Position.Z - s.pos.Z)
					away = (away.Magnitude > 0.1) and away.Unit or Vector3.new(1, 0, 0)
					remote:FireClient(plr, "knock", away * LZ.KNOCK * 0.7 + Vector3.new(0, LZ.KNOCK * 0.5, 0))
				end
			end
		end
	end
end

-- ===== шина: панель разработчика и проверка =====

Bus.serve("Weather", function(cmd, a, b)
	if cmd == "set" then
		local name = tostring(a)
		if name == "storm" then
			local target = (typeof(b) == "Vector3") and b or nil
			startStorm(target, target and WC.FRONT.DEV_ARRIVE or nil)
			firstCycle = false
		elseif name == "rain" then
			if not Clock.front() then
				return false, "дождь бывает только после грозы: weather storm"
			end
			State:SetAttribute("StormT1", now())
			advance()
		elseif DUR[name] then
			-- ясно / облачно / радуга по команде: фронт (если был) сразу уходит
			if Clock.front() then
				State:SetAttribute("StormT1", now())
				State:SetAttribute("StormEnd", now())
			end
			setWeather(name, WorldMath.duration(DUR[name], rng:NextNumber()))
		else
			return false, "погода: clear cloudy storm rain rainbow"
		end
		return true, current
	elseif cmd == "strike" then
		-- для проверки: удар в точку a (Vector3) через TELEGRAPH
		if typeof(a) == "Vector3" then
			local gy = groundBelow(a)
			local tStrike = now() + LZ.TELEGRAPH
			table.insert(pending, { t = tStrike, pos = a, groundY = gy })
			remote:FireAllClients("strike", a, gy, tStrike, rng:NextInteger(1, 1e6))
			return true
		end
		return false
	elseif cmd == "info" then
		local w, t0, t1 = Clock.weather()
		local c = Clock.frontCenter()
		return {
			weather = w,
			t0 = t0,
			t1 = t1,
			left = t1 - now(),
			front = c,
			life = Clock.stormLife(),
			jitter = Flows and Flows.jitter or nil,
			pending = #pending,
		}
	end
	return nil
end)

-- ===== главный цикл =====

local acc = 0
local rodAcc = 99
RunService.Heartbeat:Connect(function(dt)
	local t = now()

	-- исполнить ждущие удары (даже если гроза уже кончилась — предупреждение было)
	for i = #pending, 1, -1 do
		local s = pending[i]
		if t >= s.t then
			table.remove(pending, i)
			resolveStrike(s)
		end
	end

	acc += dt
	if acc < 0.2 then
		return
	end
	acc = 0

	-- смена погоды
	local T1 = State:GetAttribute("WeatherT1") or 0
	if t >= T1 then
		advance()
	end

	-- дрожь течений (та же формула у игроков)
	if Flows then
		Flows.jitter = Clock.jitter(t)
	end

	-- молнии
	rodAcc += 0.2
	if rodAcc > 5 then
		rodAcc = 0
		refreshRayFilter()
	end
	if Clock.lightningOn(t) and t >= nextStrike then
		nextStrike = t + rng:NextNumber(LZ.EVERY[1], LZ.EVERY[2])
		scheduleStrike()
	end
end)


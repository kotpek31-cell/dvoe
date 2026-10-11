-- Тесты чистой логики этапа 4: luau tests/run.luau (из папки stage4)
local shim = require("./shim")
local Vector3 = shim.Vector3

local WorldMath = require("../ReplicatedStorage/Archipelago/WorldMath")
local Route = require("../ReplicatedStorage/Archipelago/Movers/Route")


local fails, passes = 0, 0
local function check(name, cond, info)
	if cond then
		passes += 1
	else
		fails += 1
		print("FAIL  " .. name .. (info and ("  — " .. tostring(info)) or ""))
	end
end
local function near(a, b, eps) return math.abs(a - b) <= (eps or 1e-6) end

-- ===== сутки =====
local phases, L = WorldMath.normPhases({ dawn = 2, day = 10, sunset = 2, night = 8, predawn = 2 })
check("длина суток 1440 с", L == 1440, L)
local phases2, L2 = WorldMath.normPhases({ { "dawn", 2 }, { "day", 10 }, { "sunset", 2 }, { "night", 8 }, { "predawn", 2 } })
check("список фаз = словарь", L2 == L and phases2[4].name == "night")
local phases3, L3 = WorldMath.normPhases({ { name = "dawn", min = 2 }, { name = "day", min = 10 } })
check("список {name,min}", L3 == 720 and phases3[2].t0 == 120)

local CLOCK = { dawn = { 5, 7 }, day = { 7, 17 }, sunset = { 17, 19 }, night = { 19, 28.5 }, predawn = { 4.5, 5 } }
-- полный цикл: часы непрерывны и идут по кругу без скачков (кроме перехода через 24)
local prevClock = nil
local seen = {}
local maxJump = 0
for c = 0, L - 1, 1 do
	local clock, name = WorldMath.dayAt(c, phases, CLOCK)
	seen[name] = (seen[name] or 0) + 1
	if prevClock then
		local d = (clock - prevClock) % 24
		maxJump = math.max(maxJump, d)
	end
	prevClock = clock
end
check("все 5 фаз за цикл", seen.dawn and seen.day and seen.sunset and seen.night and seen.predawn)
check("фазы по минутам", seen.dawn == 120 and seen.day == 600 and seen.sunset == 120 and seen.night == 480 and seen.predawn == 120, seen.day)
check("часы без скачков (≤ 0.1 ч/с)", maxJump < 0.1, maxJump)
local endClock = WorldMath.dayAt(L - 0.001, phases, CLOCK)
local startClock = WorldMath.dayAt(0, phases, CLOCK)
check("цикл замкнут по часам", near(endClock, startClock, 0.01), endClock .. " vs " .. startClock)

-- обратное преобразование часов
local worst = 0
for h = 0, 23.9, 0.1 do
	local c = WorldMath.cycleForClock(h, phases, CLOCK)
	local back = WorldMath.dayAt(c, phases, CLOCK)
	local d = math.abs(((back - h) + 12) % 24 - 12)
	worst = math.max(worst, d)
end
check("cycleForClock обратно dayAt", worst < 1e-6, worst)

check("ночь в полночь", WorldMath.nightFactor(0) > 0.99)
check("день в полдень", WorldMath.nightFactor(12) < 0.01)
check("закат в 18", WorldMath.sunsetFactor(18) > 0.95)
check("не закат в 12", WorldMath.sunsetFactor(12) < 0.01)
check("фаза закатного острова = sunset на 18 ч", select(2, WorldMath.dayAt(WorldMath.cycleForClock(18, phases, CLOCK), phases, CLOCK)) == "sunset")

-- старт с фазы day: через 24 мин прошли все фазы
local startAt = WorldMath.phaseStart("day", phases)
check("начало day = 120 с", startAt == 120)

-- ===== погода =====
local W = {
	clear = { cloudy = 1 },
	cloudy = { storm = 0.65, clear = 0.35 },
	storm = { rain = 1 },
	rain = { rainbow = 0.7, clear = 0.3 },
	rainbow = { clear = 1 },
}
check("веса: из ясно только облачно", WorldMath.pickWeighted(W.clear, 0.99) == "cloudy")
check("веса: детерминированы", WorldMath.pickWeighted(W.cloudy, 0.1) == WorldMath.pickWeighted(W.cloudy, 0.1))
local cnt = { storm = 0, clear = 0 }
for i = 0, 999 do
	local r = (i + 0.5) / 1000
	local k = WorldMath.pickWeighted(W.cloudy, r)
	cnt[k] += 1
end
check("веса 65/35", math.abs(cnt.storm - 650) <= 2, cnt.storm)
check("длительность {8,12}", WorldMath.duration({ 8, 12 }, 0) == 480 and WorldMath.duration({ 8, 12 }, 1) == 720)
check("длительность числом", WorldMath.duration(4, 0.3) == 240)
-- гарантия первой грозы: 6 мин ясно + 4 облачно = гроза на 10-й минуте (< 24)
local firstStormAt = 6 * 60 + WorldMath.duration(4, 0)
check("первая гроза до 24 минут", firstStormAt < 24 * 60, firstStormAt)
-- гроза кончается до конца первых суток: старт 10 мин + max 7 мин гроза
check("гроза целиком в первые 24 минуты", firstStormAt + 7 * 60 < 24 * 60)

-- фронт
local f = { x0 = -3000, z0 = 0, dx = 1, dz = 0, speed = 20, width = 2800, depth = 1100, t0 = 100, t1 = 100 + 360, tEnd = 100 + 450, rampIn = 40, top = 1700, edge = 500 }
check("вне времени — 0", WorldMath.frontIntensity(f, -3000, 0, 0, 50) == 0)
check("в центре в разгар — 1", near(WorldMath.frontIntensity(f, -3000 + 20 * 200, 0, 0, 300), 1, 1e-9))
check("далеко сбоку — 0", WorldMath.frontIntensity(f, -3000 + 20 * 200, 0, 5000, 300) == 0)
check("высоко — 0", WorldMath.frontIntensity(f, -3000 + 20 * 200, 2500, 0, 300) == 0)
check("дождь слабее грозы", WorldMath.frontEnvelope(f, 500) < 0.75 and WorldMath.frontEnvelope(f, 500) > 0)
check("после конца — 0", WorldMath.frontEnvelope(f, 551) == 0)
check("молнии только в грозе", WorldMath.frontLightning(f, 300) == 1 and WorldMath.frontLightning(f, 500) == 0)
check("сэмплы фронта", #WorldMath.frontSamples(f, 16, 3) == 17 * 3 * 3)
local jmin, jmax = 9, -9
for t = 100, 550, 0.37 do
	local j = WorldMath.jitter(t, 123, 0.2, WorldMath.frontEnvelope(f, t))
	jmin, jmax = math.min(jmin, j), math.max(jmax, j)
end
check("дрожь в пределах 1 ± 0.2", jmin >= 0.8 - 1e-9 and jmax <= 1.2 + 1e-9, jmin .. ".." .. jmax)
check("без грозы дрожи нет", WorldMath.jitter(10, 1, 0.2, 0) == 1)

-- ===== Страж: фазы =====
local TH = { 1.0, 0.66, 0.33 }
check("фаза 1 при 100%", WorldMath.guardianPhase(1, TH) == 1)
check("фаза 1 при 70%", WorldMath.guardianPhase(0.7, TH) == 1)
check("фаза 2 при 66%", WorldMath.guardianPhase(0.66, TH) == 2)
check("фаза 3 при 10%", WorldMath.guardianPhase(0.1, TH) == 3)

-- пружина: перелёт и успокоение
local s = { x = 0, v = 0 }
local peak = 0
for _ = 1, 120 do
	WorldMath.spring(s, 1, 2, 0.35, 1 / 60)
	peak = math.max(peak, s.x)
end
check("пружина перелетает цель", peak > 1.05, peak)
for _ = 1, 600 do
	WorldMath.spring(s, 1, 2, 0.35, 1 / 60)
end
check("пружина успокаивается", near(s.x, 1, 1e-3), s.x)

-- ===== маршруты китов =====
local Life = require("./_gen/Life")
local ORIGIN = Vector3.new(0, 10, 0)
local LOOP = { 8000, 12000 }
local SPEED = { 25, 35 }
for _, def in ipairs(Life.WHALES) do
	local pts = {}
	local minY, maxR = math.huge, 0
	for _, v in ipairs(def.route) do
		local p = ORIGIN + v
		table.insert(pts, { p.X, p.Y, p.Z })
	end
	local r = Route.new(pts)
	local len = r:length()
	local period = len / def.speed
	check("кит " .. def.id .. ": длина кольца 8–12 тыс.", len >= LOOP[1] and len <= LOOP[2], math.floor(len))
	check("кит " .. def.id .. ": круг 5–7 мин", period >= 300 and period <= 420, math.floor(period))
	check("кит " .. def.id .. ": скорость 25–35", def.speed >= SPEED[1] and def.speed <= SPEED[2])
	-- равномерная скорость: соседние точки на равном расстоянии
	local dmin, dmax = math.huge, 0
	local N = 400
	local px, py, pz = r:at(0)
	for k = 1, N do
		local x, y, z = r:at(k / N)
		local d = math.sqrt((x - px) ^ 2 + (y - py) ^ 2 + (z - pz) ^ 2)
		dmin, dmax = math.min(dmin, d), math.max(dmax, d)
		px, py, pz = x, y, z
		minY = math.min(minY, y)
		maxR = math.max(maxR, math.sqrt(x * x + z * z))
	end
	check("кит " .. def.id .. ": скорость ровная (±3%)", dmax / dmin < 1.06, string.format("%.3f", dmax / dmin))
	check("кит " .. def.id .. ": над облачным морем", minY > 10 - 500 + 40, minY)
	check("кит " .. def.id .. ": в пределах мира", maxR < 8500, maxR)
	-- не заходит в хаб (радиус 620 + запас на длину)
	local minHub = math.huge
	for k = 0, 399 do
		local x, _, z = r:at(k / 400)
		minHub = math.min(minHub, math.sqrt(x * x + z * z))
	end
	check("кит " .. def.id .. ": мимо хаба", minHub > 620 + 100, math.floor(minHub))
	-- кольцо замкнуто
	local ax, ay, az = r:at(0)
	local bx, by, bz = r:at(0.99999)
	check("кит " .. def.id .. ": кольцо замкнуто", math.abs(ax - bx) + math.abs(ay - by) + math.abs(az - bz) < 1)
end

-- один и тот же момент → одна точка (кит у всех в одном месте)
do
	local def = Life.WHALES[1]
	local pts = {}
	for _, v in ipairs(def.route) do
		local p = ORIGIN + v
		table.insert(pts, { p.X, p.Y, p.Z })
	end
	local r1, r2 = Route.new(pts), Route.new(pts)
	local t = 1728661234.567
	local period = r1:length() / def.speed
	local s = ((t / period) + def.phase) % 1
	local x1, y1, z1 = r1:at(s)
	local x2, y2, z2 = r2:at(s)
	check("кит в одной точке у двух игроков", x1 == x2 and y1 == y2 and z1 == z2)
end

-- медузы: число в стайке в пределах 6–12
for _, g in ipairs(Life.JELLY_GROUPS) do
	check("стайка " .. g.id .. ": 6–12 медуз", g.count >= 6 and g.count <= 12)
end

print(string.format("ИТОГО: %d прошло, %d упало", passes, fails))
if fails > 0 then
	error("тесты упали")
end

--!nonstrict
-- WorldMath — чистая математика «Живого мира» (этап 4): сутки, погода, фронт грозы, дрожь течений, шум.
-- Без Roblox API: её же проверяют тесты вне Studio. Время везде — секунды сервера (GetServerTimeNow).

local M = {}

M.PHASE_ORDER = { "dawn", "day", "sunset", "night", "predawn" }
M.WEATHER = { "clear", "cloudy", "storm", "rain", "rainbow" }

local function clamp(x, a, b)
	if x < a then
		return a
	elseif x > b then
		return b
	end
	return x
end
M.clamp = clamp

function M.lerp(a, b, t)
	return a + (b - a) * t
end

-- плавная ступенька 0→1 между a и b
function M.smooth(a, b, x)
	if a == b then
		return x >= b and 1 or 0
	end
	local t = clamp((x - a) / (b - a), 0, 1)
	return t * t * (3 - 2 * t)
end

-- ===== Сутки =====

-- Config.Day.PHASES может быть словарём {dawn = 2, ...}, списком {{"dawn", 2}, ...} или {{name =, min =}}.
-- Возвращает список {name, min, t0, t1} (секунды от начала цикла) и длину цикла.
function M.normPhases(P)
	local out = {}
	if type(P) == "table" and P[1] ~= nil then
		for _, e in ipairs(P) do
			local name = e.name or e.id or e[1]
			local min = e.min or e.minutes or e.len or e[2]
			if type(name) == "string" and type(min) == "number" then
				table.insert(out, { name = name, min = min })
			end
		end
	elseif type(P) == "table" then
		for _, name in ipairs(M.PHASE_ORDER) do
			local v = P[name]
			if type(v) == "table" then
				v = v.min or v.minutes or v[1]
			end
			if type(v) == "number" then
				table.insert(out, { name = name, min = v })
			end
		end
	end
	if #out == 0 then
		out = {
			{ name = "dawn", min = 2 },
			{ name = "day", min = 10 },
			{ name = "sunset", min = 2 },
			{ name = "night", min = 8 },
			{ name = "predawn", min = 2 },
		}
	end
	local acc = 0
	for _, e in ipairs(out) do
		e.t0 = acc
		acc += e.min * 60
		e.t1 = acc
	end
	return out, acc
end

-- место в цикле (0 ≤ c < L) по времени сервера
function M.cyclePos(t, epoch, offset, L)
	local c = (t - epoch + offset) % L
	if c < 0 then
		c += L
	end
	return c
end

-- clockMap: {dawn = {5, 7}, ...} — часы начала и конца фазы (конец может быть > 24)
-- Возвращает часы (0–24), имя фазы, долю фазы 0–1
function M.dayAt(c, phases, clockMap)
	for _, ph in ipairs(phases) do
		if c < ph.t1 or ph == phases[#phases] then
			local p = clamp((c - ph.t0) / math.max(ph.t1 - ph.t0, 1e-6), 0, 1)
			local range = clockMap[ph.name] or { 12, 12 }
			local clock = (range[1] + (range[2] - range[1]) * p) % 24
			return clock, ph.name, p
		end
	end
	return 12, "day", 0
end

-- обратное: место в цикле, при котором часы = hour
function M.cycleForClock(hour, phases, clockMap)
	hour = hour % 24
	for _, ph in ipairs(phases) do
		local r = clockMap[ph.name]
		if r then
			local a, b = r[1], r[2]
			for _, h in ipairs({ hour, hour + 24 }) do
				if h >= a and h <= b and b > a then
					return ph.t0 + (h - a) / (b - a) * (ph.t1 - ph.t0), ph.name
				end
			end
		end
	end
	return 0, phases[1].name
end

-- начало фазы в цикле
function M.phaseStart(name, phases)
	for _, ph in ipairs(phases) do
		if ph.name == name then
			return ph.t0
		end
	end
	return 0
end

-- 0 днём, 1 ночью (по часам)
function M.nightFactor(clock)
	if clock >= 12 then
		return M.smooth(18.4, 19.7, clock)
	end
	return 1 - M.smooth(4.6, 6.1, clock)
end

-- 1 на закате (≈18 ч), 0 далеко от него
function M.sunsetFactor(clock)
	return 1 - M.smooth(0.5, 1.6, math.abs(clock - 18.1))
end

-- 1 на рассвете (≈6 ч)
function M.dawnFactor(clock)
	return 1 - M.smooth(0.5, 1.6, math.abs(clock - 5.9))
end

-- ключевые кадры {{h, {...}}, ...} по часам (по кругу), значения — числа или таблицы {r,g,b}
-- Возвращает индексы соседних кадров и долю (плавно)
function M.keyframeAt(keys, clock)
	local n = #keys
	for i = 1, n do
		local a = keys[i]
		local b = keys[i % n + 1]
		local ha, hb = a[1], b[1]
		if hb <= ha then
			hb += 24
		end
		local h = clock
		if h < ha then
			h += 24
		end
		if h >= ha and h <= hb then
			local t = (h - ha) / math.max(hb - ha, 1e-6)
			t = t * t * (3 - 2 * t)
			return i, i % n + 1, t
		end
	end
	return 1, 1, 0
end

-- ===== Погода =====

-- weights: {name = w}; r — число 0–1. Порядок ключей фиксирован (детерминированно).
function M.pickWeighted(weights, r)
	local keys = {}
	local total = 0
	for k, w in pairs(weights) do
		if type(w) == "number" and w > 0 then
			table.insert(keys, k)
			total += w
		end
	end
	if total <= 0 then
		return nil
	end
	table.sort(keys)
	local x = r * total
	for _, k in ipairs(keys) do
		x -= weights[k]
		if x <= 0 then
			return k
		end
	end
	return keys[#keys]
end

-- spec: минуты числом или {от, до}; r — 0–1. Возвращает секунды.
function M.duration(spec, r)
	if type(spec) == "table" then
		local a, b = spec[1] or 1, spec[2] or spec[1] or 1
		return (a + (b - a) * r) * 60
	end
	return (tonumber(spec) or 1) * 60
end

-- ===== Фронт грозы =====
-- f = {x0, z0, dx, dz, speed, width, depth, t0, t1, tEnd, rampIn, top, edge}
-- t0 — начало, t1 — конец грозы, tEnd — конец дождя.

function M.frontCenter(f, t)
	local d = f.speed * (t - f.t0)
	return f.x0 + f.dx * d, f.z0 + f.dz * d
end

-- жизнь фронта 0–1: нарастает rampIn секунд, держится до t1, к tEnd стихает до 0
function M.frontEnvelope(f, t)
	if t < f.t0 or t >= f.tEnd then
		return 0
	end
	local up = M.smooth(f.t0, f.t0 + (f.rampIn or 40), t)
	if t <= f.t1 then
		return up
	end
	-- дождь стихает: от 0.75 до 0
	local k = (t - f.t1) / math.max(f.tEnd - f.t1, 1e-6)
	return up * 0.75 * (1 - k) ^ 1.4
end

-- молнии только в грозе (не в стихающем дожде), не в первые полминуты
function M.frontLightning(f, t)
	if t < f.t0 + (f.rampIn or 40) * 0.6 or t > f.t1 then
		return 0
	end
	return 1
end

-- координаты точки в системе фронта: u — вдоль хода (+ впереди), v — поперёк
function M.frontLocal(f, x, z, t)
	local cx, cz = M.frontCenter(f, t)
	local px, pz = x - cx, z - cz
	local u = px * f.dx + pz * f.dz
	local v = -px * f.dz + pz * f.dx
	return u, v
end

-- сила грозы в точке 0–1 (без масок регионов — их добавляет WorldClock)
function M.frontIntensity(f, x, y, z, t)
	local env = M.frontEnvelope(f, t)
	if env <= 0 then
		return 0
	end
	local u, v = M.frontLocal(f, x, z, t)
	local edge = f.edge or 500
	local a = 1 - M.smooth(f.depth * 0.5, f.depth * 0.5 + edge, math.abs(u))
	if a <= 0 then
		return 0
	end
	local b = 1 - M.smooth(f.width * 0.5, f.width * 0.5 + edge, math.abs(v))
	if b <= 0 then
		return 0
	end
	local top = f.top or 1700
	local h = 1 - M.smooth(top, top + 500, y)
	return env * a * b * h
end

-- точки для проверки пути фронта: вдоль всего пути (t0..tEnd), по сетке ширина × глубина
function M.frontSamples(f, steps, lanes)
	local pts = {}
	steps = steps or 14
	lanes = lanes or 3
	for i = 0, steps do
		local t = f.t0 + (f.tEnd - f.t0) * i / steps
		local cx, cz = M.frontCenter(f, t)
		for a = 0, lanes - 1 do
			local v = (lanes == 1) and 0 or (-0.5 + a / (lanes - 1)) * f.width
			for _, u in ipairs({ -0.5 * f.depth, 0, 0.5 * f.depth }) do
				local x = cx + f.dx * u - f.dz * v
				local z = cz + f.dz * u + f.dx * v
				table.insert(pts, { x, z })
			end
		end
	end
	return pts
end

-- дрожь течений: 1 ± amp, одинакова у сервера и клиентов при одном t
function M.jitter(t, seed, amp, env)
	if env <= 0 or amp <= 0 then
		return 1
	end
	local s = seed % 1000
	local n = 0.62 * math.sin(t * 1.7 + s) + 0.38 * math.sin(t * 4.3 + s * 2.1)
	return 1 + amp * env * n
end

-- ===== Шум и хэш =====

-- детерминированное число 0–1 из целых
function M.hash01(a, b, c)
	local x = math.sin((a or 0) * 127.1 + (b or 0) * 311.7 + (c or 0) * 74.7) * 43758.5453
	return x - math.floor(x)
end

-- плавный шум 1D (значения в -1..1)
function M.noise1(x, seed)
	local i = math.floor(x)
	local f = x - i
	local a = M.hash01(i, seed or 0) * 2 - 1
	local b = M.hash01(i + 1, seed or 0) * 2 - 1
	local u = f * f * (3 - 2 * f)
	return a + (b - a) * u
end

-- ===== Пружина (для анимаций) =====
-- s = {x, v}; возвращает новое x. f — частота (Гц), z — затухание (<1 = перелёт)
function M.spring(s, target, f, z, dt)
	local w = 2 * math.pi * f
	local steps = math.max(1, math.ceil(dt / (1 / 120)))
	local h = dt / steps
	for _ = 1, steps do
		local a = -w * w * (s.x - target) - 2 * z * w * s.v
		s.v += a * h
		s.x += s.v * h
	end
	return s.x
end

-- ===== Страж: фазы =====
-- thresholds: {1, 0.66, 0.33} → номер фазы по доле здоровья
function M.guardianPhase(frac, thresholds)
	local phase = 1
	for i, th in ipairs(thresholds) do
		if frac <= th + 1e-9 then
			phase = i
		end
	end
	return phase
end

return M

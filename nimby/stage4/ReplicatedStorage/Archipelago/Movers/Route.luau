--!nonstrict
-- Route — замкнутая кривая Катмулла — Рома по точкам с равномерной скоростью по длине.
-- Чистая математика (числа, без Vector3): ею же пользуются тесты вне Studio.
-- points: { {x, y, z}, ... } (не меньше 3)

local Route = {}
Route.__index = Route

local SAMPLES_PER_SEG = 48

local function catmull(p0, p1, p2, p3, t)
	local t2, t3 = t * t, t * t * t
	local function c(i)
		return 0.5
			* (
				2 * p1[i]
				+ (-p0[i] + p2[i]) * t
				+ (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2
				+ (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3
			)
	end
	return c(1), c(2), c(3)
end

function Route.new(points)
	assert(type(points) == "table" and #points >= 3, "Route: нужно не меньше 3 точек")
	local self = setmetatable({}, Route)
	self.pts = points
	self.n = #points
	-- таблица длины: u (0..n) → накопленная длина
	local us, lens = { 0 }, { 0 }
	local px, py, pz = self:_eval(0)
	local total = 0
	local count = self.n * SAMPLES_PER_SEG
	for k = 1, count do
		local u = k / SAMPLES_PER_SEG
		local x, y, z = self:_eval(u)
		local dx, dy, dz = x - px, y - py, z - pz
		total += math.sqrt(dx * dx + dy * dy + dz * dz)
		us[k + 1] = u
		lens[k + 1] = total
		px, py, pz = x, y, z
	end
	self.us, self.lens, self.total = us, lens, total
	return self
end

-- точка по параметру u (0..n, по кругу)
function Route:_eval(u)
	local n = self.n
	u = u % n
	local i = math.floor(u)
	local t = u - i
	local p = self.pts
	local function at(k)
		return p[(k % n) + 1]
	end
	return catmull(at(i - 1), at(i), at(i + 1), at(i + 2), t)
end

-- u по доле длины s (0..1)
function Route:_uAt(s)
	s = s % 1
	local target = s * self.total
	local lens = self.lens
	local lo, hi = 1, #lens
	while hi - lo > 1 do
		local mid = (lo + hi) // 2
		if lens[mid] < target then
			lo = mid
		else
			hi = mid
		end
	end
	local l0, l1 = lens[lo], lens[hi]
	local k = (l1 > l0) and (target - l0) / (l1 - l0) or 0
	return self.us[lo] + (self.us[hi] - self.us[lo]) * k
end

-- место по доле длины s (0..1): x, y, z
function Route:at(s)
	return self:_eval(self:_uAt(s))
end

-- единичная касательная по доле длины s
function Route:tangent(s)
	local d = 1 / math.max(self.total, 1)
	local ax, ay, az = self:at(s - d)
	local bx, by, bz = self:at(s + d)
	local dx, dy, dz = bx - ax, by - ay, bz - az
	local l = math.sqrt(dx * dx + dy * dy + dz * dz)
	if l < 1e-6 then
		return 0, 0, -1
	end
	return dx / l, dy / l, dz / l
end

-- поворот по курсу (рад/стад) в точке s — для крена
function Route:yawRate(s, ds)
	ds = ds or (20 / math.max(self.total, 1))
	local ax, _, az = self:tangent(s - ds)
	local bx, _, bz = self:tangent(s + ds)
	local a1 = math.atan2(ax, az)
	local a2 = math.atan2(bx, bz)
	local d = a2 - a1
	if d > math.pi then
		d -= 2 * math.pi
	elseif d < -math.pi then
		d += 2 * math.pi
	end
	return d / (2 * ds * self.total)
end

function Route:length()
	return self.total
end

return Route

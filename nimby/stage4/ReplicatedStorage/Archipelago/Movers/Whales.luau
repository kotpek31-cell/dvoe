--!nonstrict
-- Whales — где кит в момент t (время сервера). Одна формула у сервера и всех игроков:
-- кит у всех в одной точке без сетевого обмена. Маршрут — Config.Life.WHALES[i].route (от ORIGIN).

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Arch = ReplicatedStorage:WaitForChild("Archipelago")
local ConfigF = Arch:WaitForChild("Config")
local World = require(ConfigF:WaitForChild("World"))
local Creatures = require(ConfigF:WaitForChild("Creatures"))
local Life = require(ConfigF:WaitForChild("Life"))
local Route = require(script.Parent:WaitForChild("Route"))

local ORIGIN = (typeof(World.ORIGIN) == "Vector3") and World.ORIGIN or Vector3.new(0, 10, 0)
local W = Life.WHALE
local SPEED = Creatures.WHALE and Creatures.WHALE.SPEED or { 25, 35 }

local Whales = {}
Whales.list = {}

-- страница летописи в саду «Старого кита»: смещение от точки на спине (Whales.backAt)
Whales.GARDEN_PAGE = CFrame.new(0, 3.2, -9)

local count = math.min(#Life.WHALES, (Creatures.WHALE and Creatures.WHALE.COUNT) or #Life.WHALES)
for i = 1, count do
	local def = Life.WHALES[i]
	local pts = {}
	for _, v in ipairs(def.route) do
		local p = ORIGIN + v
		table.insert(pts, { p.X, p.Y, p.Z })
	end
	local route = Route.new(pts)
	local speed = math.clamp(def.speed or 30, SPEED[1], SPEED[2])
	table.insert(Whales.list, {
		index = i,
		id = def.id,
		def = def,
		route = route,
		length = route:length(),
		speed = speed,
		period = route:length() / speed,
		phase = def.phase or 0,
		size = ((Creatures.WHALE and Creatures.WHALE.LENGTH) or 120) * (def.scale or 1),
	})
end

function Whales.byId(id: string)
	for _, w in ipairs(Whales.list) do
		if w.id == id then
			return w
		end
	end
	return nil
end

-- доля круга (0..1) головы кита в момент t
function Whales.s(w, t: number): number
	return ((t / w.period) + w.phase) % 1
end

-- точка маршрута на back стад позади головы
function Whales.pointAt(w, t: number, back: number?): Vector3
	local s = Whales.s(w, t) - (back or 0) / w.length
	local x, y, z = w.route:at(s)
	return Vector3.new(x, y, z)
end

-- CFrame куска тела на back стад позади головы: смотрит по ходу, с креном в поворотах
function Whales.frameAt(w, t: number, back: number?): CFrame
	local s = Whales.s(w, t) - (back or 0) / w.length
	local x, y, z = w.route:at(s)
	local tx, ty, tz = w.route:tangent(s)
	local pos = Vector3.new(x, y, z)
	local look = Vector3.new(tx, ty * 0.6, tz)
	if look.Magnitude < 1e-4 then
		look = Vector3.new(0, 0, -1)
	end
	local roll = math.clamp(-w.route:yawRate(s) * W.BANK_GAIN, -W.BANK, W.BANK)
	return CFrame.lookAt(pos, pos + look.Unit) * CFrame.Angles(0, 0, roll)
end

-- голова (для сервера: телепорт, проверки)
function Whales.headAt(w, t: number): Vector3
	return Whales.pointAt(w, t, 0)
end

-- точка на спине (середина тела, сверху): back стад от головы, up — над осью
-- (по умолчанию — площадка, на которой стоят игроки; та же у сервера и у WhaleBuilder)
function Whales.backAt(w, t: number, back: number?, up: number?): CFrame
	local cf = Whales.frameAt(w, t, back or w.size * 0.42)
	return cf * CFrame.new(0, up or (w.size * 0.125), 0)
end

-- проверка маршрута: длина, высота, исключённые зоны (для Stage4Check)
function Whales.audit()
	local out = {}
	local LOOP = Creatures.WHALE and Creatures.WHALE.LOOP_LENGTH or { 8000, 12000 }
	for _, w in ipairs(Whales.list) do
		local bad = 0
		if World.inExclusion then
			for k = 0, 199 do
				local x, y, z = w.route:at(k / 200)
				local ok, r = pcall(World.inExclusion, Vector3.new(x, y, z))
				if ok and r then
					bad += 1
				end
			end
		end
		table.insert(out, {
			id = w.id,
			length = math.floor(w.length),
			period = math.floor(w.period),
			lengthOk = w.length >= LOOP[1] and w.length <= LOOP[2],
			periodOk = w.period >= 300 and w.period <= 420,
			exclusionHits = bad,
		})
	end
	return out
end

return Whales

--!nonstrict
-- Jellies — где медуза в момент t (время сервера). Одна формула у сервера и игроков:
-- сервер по ней проверяет запрос «прыгнул на медузу».

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Arch = ReplicatedStorage:WaitForChild("Archipelago")
local ConfigF = Arch:WaitForChild("Config")
local World = require(ConfigF:WaitForChild("World"))
local Creatures = require(ConfigF:WaitForChild("Creatures"))
local Life = require(ConfigF:WaitForChild("Life"))

local ORIGIN = (typeof(World.ORIGIN) == "Vector3") and World.ORIGIN or Vector3.new(0, 10, 0)
local J = Life.JELLY
local GROUP = (Creatures.JELLY and Creatures.JELLY.GROUP) or { 6, 12 }

local Jellies = {}
Jellies.groups = {}

local GOLDEN = 2.39996323

for gi, g in ipairs(Life.JELLY_GROUPS) do
	local n = math.clamp(g.count or 8, GROUP[1], GROUP[2])
	local items = {}
	for j = 1, n do
		local h = ((gi * 7919 + j * 104729) % 1000) / 1000
		local size = J.SIZE[1] + (J.SIZE[2] - J.SIZE[1]) * h
		items[j] = {
			angle = j * GOLDEN,
			rad = g.radius * math.sqrt((j - 0.5) / n),
			y = (h - 0.5) * 40,
			size = size,
			color = J.COLORS[(j - 1) % #J.COLORS + 1],
			ph = j * 1.31 + gi,
		}
	end
	table.insert(Jellies.groups, {
		index = gi,
		id = g.id,
		region = g.region,
		center = ORIGIN + g.center,
		radius = g.radius,
		items = items,
	})
end

-- центр колокола медузы j группы g в момент t
function Jellies.pos(g: number, j: number, t: number): Vector3?
	local grp = Jellies.groups[g]
	local it = grp and grp.items[j]
	if not it then
		return nil
	end
	local a = it.angle + t * 0.035
	local dx = math.cos(a) * it.rad + math.sin(t * 0.21 + it.ph) * J.DRIFT
	local dz = math.sin(a) * it.rad + math.cos(t * 0.17 + it.ph * 1.7) * J.DRIFT
	local dy = it.y + math.sin(t * 0.55 + it.ph) * J.BOB
	return grp.center + Vector3.new(dx, dy, dz)
end

-- верх колокола
function Jellies.top(g: number, j: number, t: number): Vector3?
	local p = Jellies.pos(g, j, t)
	if not p then
		return nil
	end
	local it = Jellies.groups[g].items[j]
	return p + Vector3.new(0, it.size * 0.32, 0)
end

return Jellies

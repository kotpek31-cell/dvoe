--!nonstrict
-- BirdsClient — птицы-искорки: стайки по 20–40 огоньков кружат над ближними островами.
-- Только у самого игрока (сеть не нагружают). Пролетишь сквозь стайку — она со звоном разлетается
-- и через пару секунд собирается снова.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Arch = ReplicatedStorage:WaitForChild("Archipelago")
local ConfigF = Arch:WaitForChild("Config")
local FX = require(Arch:WaitForChild("WorldFX"))
local Life = require(ConfigF:WaitForChild("Life"))
local Creatures = require(ConfigF:WaitForChild("Creatures"))
local Ambience = require(ConfigF:WaitForChild("Ambience"))
local Clock = FX.Clock

local player = Players.LocalPlayer
local B = Life.BIRDS
local GROUP = (Creatures.BIRDS and Creatures.BIRDS.GROUP) or { 20, 40 }
local ORIGIN = Clock.ORIGIN

local folder = FX.localFolder("Birds")
local rng = Random.new()

local flocks = {} -- [key] = flock
local bboxCache = setmetatable({}, { __mode = "k" })
local T_BASE = os.clock() -- для math.noise (float32): маленькие числа

local function makeBird(color: Color3, withTrail: boolean, parent: Instance): Part
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = false
	p.Shape = Enum.PartType.Ball
	local s = rng:NextNumber(0.45, 0.75)
	p.Size = Vector3.new(s, s, s)
	p.Material = Enum.Material.Neon
	p.Color = color
	if withTrail then
		local a0 = Instance.new("Attachment")
		a0.Position = Vector3.new(0, s * 0.3, 0)
		a0.Parent = p
		local a1 = Instance.new("Attachment")
		a1.Position = Vector3.new(0, -s * 0.3, 0)
		a1.Parent = p
		local tr = Instance.new("Trail")
		tr.Attachment0 = a0
		tr.Attachment1 = a1
		tr.Lifetime = 0.35
		tr.LightEmission = 1
		tr.Color = ColorSequence.new(color)
		tr.Transparency = NumberSequence.new(0.3, 1)
		tr.WidthScale = NumberSequence.new(1, 0)
		tr.FaceCamera = true
		tr.Parent = p
	end
	p.Parent = parent
	return p
end

local function newFlock(key, anchor: Vector3, seed: number)
	local r = Random.new(seed)
	local n = r:NextInteger(GROUP[1], GROUP[2])
	n = math.max(8, math.floor(n * (0.5 + 0.5 * FX.quality())))
	local color = B.COLORS[r:NextInteger(1, #B.COLORS)]
	local model = Instance.new("Model")
	model.Name = "Flock"
	local birds, parts = {}, {}
	local radius = r:NextNumber(B.ORBIT[1], B.ORBIT[2])
	local height = r:NextNumber(B.HEIGHT[1], B.HEIGHT[2])
	for i = 1, n do
		local col = color:Lerp(Color3.new(1, 1, 1), r:NextNumber(0, 0.35))
		local p = makeBird(col, (i % B.TRAIL_EVERY) == 0, model)
		parts[i] = p
		birds[i] = {
			a0 = r:NextNumber(0, math.pi * 2),
			rr = radius * r:NextNumber(0.55, 1.15),
			h = height + r:NextNumber(-10, 10),
			bob = r:NextNumber(0.6, 1.4),
			ph = r:NextNumber(0, 10),
			lag = r:NextNumber(-0.25, 0.25),
			scatter = Vector3.zero,
		}
	end
	model.Parent = folder
	return {
		key = key,
		anchor = anchor,
		model = model,
		parts = parts,
		birds = birds,
		speed = r:NextNumber(B.SPEED[1], B.SPEED[2]) * (r:NextNumber() < 0.5 and -1 or 1),
		scatterT = -99,
		scatterAt = Vector3.zero,
		cfs = table.create(n),
		seed = seed,
	}
end

local function islandAnchors(cam: Vector3)
	local list = {}
	local wa = workspace:FindFirstChild("Archipelago")
	local islands = wa and wa:FindFirstChild("Islands")
	if islands then
		for _, regionFolder in ipairs(islands:GetChildren()) do
			for _, m in ipairs(regionFolder:GetChildren()) do
				if m:IsA("Model") then
					-- остров мог прийти частями (подгрузка): пересчёт раз в 10 с, пустую рамку не помним
					local c = bboxCache[m]
					if not c or os.clock() - c[2] > 10 then
						local ok, cf, size = pcall(m.GetBoundingBox, m)
						if ok and size.Magnitude > 1 then
							c = { cf.Position + Vector3.new(0, size.Y * 0.5, 0), os.clock() }
							bboxCache[m] = c
						else
							c = nil
							bboxCache[m] = nil
						end
					end
					if c then
						local d = (c[1] - cam).Magnitude
						if d < B.RANGE then
							table.insert(list, { key = m, pos = c[1], d = d })
						end
					end
				end
			end
		end
	end
	if #list == 0 then
		for i, off in ipairs(B.FALLBACK) do
			local pos = ORIGIN + off
			local d = (pos - cam).Magnitude
			if d < B.RANGE then
				table.insert(list, { key = "fallback" .. i, pos = pos, d = d })
			end
		end
	end
	table.sort(list, function(a, b)
		return a.d < b.d
	end)
	return list
end

local function refresh(cam: Vector3)
	local want = {}
	local list = islandAnchors(cam)
	for i = 1, math.min(#list, B.MAX_FLOCKS) do
		want[list[i].key] = list[i]
	end
	for key, fl in pairs(flocks) do
		if not want[key] then
			fl.model:Destroy()
			flocks[key] = nil
		end
	end
	for key, a in pairs(want) do
		local fl = flocks[key]
		if not fl then
			local seed = math.floor(a.pos.X * 0.37 + a.pos.Z * 1.31) % 100000
			flocks[key] = newFlock(key, a.pos, seed)
		elseif (fl.anchor - a.pos).Magnitude > 2 then
			fl.anchor = a.pos -- рамка острова уточнилась
		end
	end
end

local function clearAll()
	for key, fl in pairs(flocks) do
		fl.model:Destroy()
		flocks[key] = nil
	end
end

local function scatterFx(pos: Vector3, color: Color3)
	local s = Ambience.BIRDS_SCATTER
	FX.sound(s.id, pos, { volume = s.volume, speed = s.speed * rng:NextNumber(0.9, 1.1), range = 160, min = 10 })
	FX.burst(pos, color, 18, 18, 0.6, true)
end

local function poseFlock(fl, t: number, hrp: BasePart?)
	local ang = t * fl.speed
	local sinceScatter = os.clock() - fl.scatterT
	local sc = 0
	if sinceScatter < B.SCATTER_TIME then
		local k = sinceScatter / B.SCATTER_TIME
		sc = math.sin(math.min(k * 3, 1) * math.pi * 0.5) * (1 - k) ^ 1.5 -- быстро разлетелись, медленно вернулись
	end
	local hit = false
	-- снова пугаться можно только когда стайка собралась (иначе разлёт перезапускается каждый кадр)
	local armed = hrp ~= nil and sinceScatter >= B.SCATTER_TIME
	local hrpPos = hrp and hrp.Position
	-- math.noise считает во float32: время сервера (~1e9) не годится, берём локальные часы
	local tn = os.clock() - T_BASE
	for i, b in ipairs(fl.birds) do
		local a = b.a0 + ang * (1 + b.lag)
		local flutter = math.noise(tn * 0.8 + b.ph, b.ph) * 6
		local pos = fl.anchor
			+ Vector3.new(math.cos(a) * (b.rr + flutter), b.h + math.sin(t * b.bob + b.ph) * 4, math.sin(a) * (b.rr + flutter))
		if sc > 0 then
			pos += b.scatter * sc
		end
		fl.cfs[i] = CFrame.new(pos)
		if armed and not hit and (pos - hrpPos).Magnitude < B.SCATTER_RADIUS * 0.4 then
			hit = true
		end
	end
	workspace:BulkMoveTo(fl.parts, fl.cfs, Enum.BulkMoveMode.FireCFrameChanged)
	-- сквозь стайку пролетели — разлёт от игрока
	if hit and hrp then
		fl.scatterT = os.clock()
		local from = hrp.Position
		for i, b in ipairs(fl.birds) do
			local p = fl.cfs[i].Position
			local away = p - from
			if away.Magnitude < 0.1 then
				away = Vector3.new(rng:NextNumber(-1, 1), 1, rng:NextNumber(-1, 1))
			end
			b.scatter = away.Unit * rng:NextNumber(18, 34) + Vector3.new(0, rng:NextNumber(6, 16), 0)
		end
		scatterFx(from, fl.parts[1].Color)
	end
end

-- щебет (если найден звук) — изредка из ближней стайки
local nextChirp = 0
local function chirp(cam: Vector3)
	if not Ambience.BIRDS_CHIRP or Ambience.BIRDS_CHIRP == 0 then
		return
	end
	if os.clock() < nextChirp then
		return
	end
	nextChirp = os.clock() + rng:NextNumber(4, 9)
	local best, bd = nil, math.huge
	for _, fl in pairs(flocks) do
		local d = (fl.anchor - cam).Magnitude
		if d < bd then
			best, bd = fl, d
		end
	end
	if best and bd < 250 then
		FX.sound(Ambience.BIRDS_CHIRP, best.anchor, { volume = 0.5, speed = rng:NextNumber(0.9, 1.2), range = 250 })
	end
end

local refreshAt = 0
RunService.RenderStepped:Connect(function()
	if not FX.inWorld() then
		if next(flocks) then
			clearAll()
		end
		return
	end
	local cam = FX.camPos()
	if os.clock() - refreshAt > 2 then
		refreshAt = os.clock()
		refresh(cam)
	end
	local t = workspace:GetServerTimeNow()
	local char = player.Character
	local hrp = char and char:FindFirstChild("HumanoidRootPart")
	for _, fl in pairs(flocks) do
		if (fl.anchor - cam).Magnitude < B.RANGE * 1.3 then
			poseFlock(fl, t, hrp)
		end
	end
	chirp(cam)
end)

--!nonstrict
-- NightClient — сутки у игрока: слой "daynight" (LightingDirector) + ночные детали мира:
-- созвездия-подсказки, северное сияние над Ледяным венцом, светлячки, окна и фонари руин,
-- проявление закатного острова. Только для игроков с WorldAccess (старая игра выглядит как раньше).

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local CollectionService = game:GetService("CollectionService")
local TweenService = game:GetService("TweenService")

local Arch = ReplicatedStorage:WaitForChild("Archipelago")
local ConfigF = Arch:WaitForChild("Config")
local FX = require(Arch:WaitForChild("WorldFX"))
local Night = require(ConfigF:WaitForChild("Night"))
local World = require(ConfigF:WaitForChild("World"))
local Ambience = require(ConfigF:WaitForChild("Ambience"))
local Clock = FX.Clock
local Director = FX.Director
local WorldMath = Clock.Math

local player = Players.LocalPlayer
local ORIGIN = Clock.ORIGIN

-- ===== слой daynight =====

local KEYS = Night.KEYS

local function mix(a, b, t)
	local ta = typeof(a)
	if ta == "number" then
		return a + (b - a) * t
	elseif ta == "Color3" then
		return a:Lerp(b, t)
	end
	return t < 0.5 and a or b
end

local function lightAt(clock: number)
	local i, j, t = WorldMath.keyframeAt(KEYS, clock)
	local A, B = KEYS[i][2], KEYS[j][2]
	local out = {}
	for k, va in pairs(A) do
		local vb = B[k]
		out[k] = (vb ~= nil) and mix(va, vb, t) or va
	end
	return out
end

local layerOn = false
local function setLayer(on: boolean)
	if not Director or layerOn == on then
		return
	end
	layerOn = on
	pcall(Director.weight, "daynight", on and 1 or 0, on and 2 or 1)
end

local lastLight = 0
local function updateLight(info)
	if not Director then
		return
	end
	if not FX.hasAccess() then
		setLayer(false)
		return
	end
	local t = os.clock()
	if t - lastLight < (Night.TICK or 1 / 15) then
		return
	end
	lastLight = t
	local props = lightAt(info.clock)
	props["Lighting.ClockTime"] = info.clock
	pcall(Director.set, "daynight", props)
	setLayer(true)
end

-- ===== созвездия (BillboardGui: туман их не прячет, острова заслоняют) =====

local skyFolder = FX.localFolder("Sky")
local skyAnchor = FX.part({ Name = "SkyAnchor", Transparency = 1, Size = Vector3.new(1, 1, 1), Parent = skyFolder })

local constellations = {}

local function dirFrom(az: number, el: number): Vector3
	local a, e = math.rad(az), math.rad(el)
	return Vector3.new(math.sin(a) * math.cos(e), math.sin(e), math.cos(a) * math.cos(e))
end

local function corner(parent)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0.5, 0)
	c.Parent = parent
end

local function buildConstellation(def)
	local att = Instance.new("Attachment")
	att.Name = def.name
	att.Position = dirFrom(def.az, def.el) * Night.SKY.DIST
	att.Parent = skyAnchor

	local gui = Instance.new("BillboardGui")
	gui.Name = def.name
	gui.Adornee = att
	gui.Size = UDim2.new(Night.SKY.SIZE, 0, Night.SKY.SIZE, 0)
	gui.LightInfluence = 0
	gui.Brightness = 2.2
	gui.AlwaysOnTop = false
	gui.MaxDistance = math.huge
	gui.ResetOnSpawn = false
	gui.Enabled = false
	gui.Parent = att

	local frames = { stars = {}, glows = {}, lines = {} }
	for _, l in ipairs(def.lines) do
		local a, b = def.stars[l[1]], def.stars[l[2]]
		if a and b then
			local ax, ay = a[1] / 10, 1 - a[2] / 10
			local bx, by = b[1] / 10, 1 - b[2] / 10
			local len = math.sqrt((bx - ax) ^ 2 + (by - ay) ^ 2)
			local f = Instance.new("Frame")
			f.AnchorPoint = Vector2.new(0.5, 0.5)
			f.Position = UDim2.fromScale((ax + bx) / 2, (ay + by) / 2)
			f.Size = UDim2.fromScale(len, 0.007)
			f.Rotation = math.deg(math.atan2(by - ay, bx - ax))
			f.BorderSizePixel = 0
			f.BackgroundColor3 = Night.SKY.LINE
			f.BackgroundTransparency = 1
			f.Parent = gui
			table.insert(frames.lines, f)
		end
	end
	for i, s in ipairs(def.stars) do
		local glow = Instance.new("Frame")
		glow.AnchorPoint = Vector2.new(0.5, 0.5)
		glow.Position = UDim2.fromScale(s[1] / 10, 1 - s[2] / 10)
		glow.Size = UDim2.fromScale(0.075, 0.075)
		glow.BorderSizePixel = 0
		glow.BackgroundColor3 = Night.SKY.COLOR
		glow.BackgroundTransparency = 1
		corner(glow)
		glow.Parent = gui
		local star = Instance.new("Frame")
		star.AnchorPoint = Vector2.new(0.5, 0.5)
		star.Position = glow.Position
		star.Size = UDim2.fromScale(0.026, 0.026)
		star.BorderSizePixel = 0
		star.BackgroundColor3 = Color3.new(1, 1, 1)
		star.BackgroundTransparency = 1
		corner(star)
		star.Parent = gui
		frames.stars[i] = star
		frames.glows[i] = glow
	end
	return { gui = gui, frames = frames }
end

for _, def in ipairs(Night.SKY.CONSTELLATIONS) do
	table.insert(constellations, buildConstellation(def))
end

local skyVis = -1
local function updateSky(vis: number, t: number)
	skyAnchor.CFrame = CFrame.new(FX.camPos())
	local on = vis > 0.02
	-- линии обновляем, когда видимость ушла от ПРИМЕНЁННОЙ больше чем на 0.01 (ночь наступает медленно)
	local applyLines = on and math.abs(vis - skyVis) > 0.01
	for ci, c in ipairs(constellations) do
		c.gui.Enabled = on
		if on then
			local f = c.frames
			for i, s in ipairs(f.stars) do
				local tw = 0.82 + 0.18 * math.sin(t * (1.3 + i * 0.37) + ci * 2.1)
				s.BackgroundTransparency = 1 - vis * tw
				f.glows[i].BackgroundTransparency = 1 - vis * 0.28 * tw
			end
			if applyLines then
				for _, l in ipairs(f.lines) do
					l.BackgroundTransparency = 1 - vis * 0.42
				end
			end
		end
	end
	if applyLines then
		skyVis = vis
	end
end

-- ===== северное сияние (Beams над Ледяным венцом) =====

local aurora = { curtains = {} }
do
	local A = Night.AURORA
	local base = FX.part({
		Name = "Aurora",
		Transparency = 1,
		Size = Vector3.new(1, 1, 1),
		CFrame = CFrame.new(ORIGIN + A.CENTER),
		Parent = skyFolder,
	})
	aurora.base = base
	for c = 1, A.CURTAINS do
		local atts = {}
		local beams = {}
		for i = 1, A.POINTS do
			local a = Instance.new("Attachment")
			local x = -A.SPAN / 2 + A.SPAN * (i - 1) / (A.POINTS - 1)
			a.Position = Vector3.new(x, (c - 1) * 140, (c - 1) * 320)
			a.Parent = base
			atts[i] = a
		end
		local col = A.COLORS[(c - 1) % #A.COLORS + 1]
		local col2 = A.COLORS[c % #A.COLORS + 1]
		for i = 1, A.POINTS - 1 do
			local b = Instance.new("Beam")
			b.Attachment0 = atts[i]
			b.Attachment1 = atts[i + 1]
			b.FaceCamera = true
			b.Width0 = A.HEIGHT * (0.8 + 0.4 * ((i * 7 + c) % 5) / 5)
			b.Width1 = A.HEIGHT * (0.8 + 0.4 * (((i + 1) * 7 + c) % 5) / 5)
			b.LightEmission = 1
			b.LightInfluence = 0
			b.Segments = 18
			b.Color = ColorSequence.new(col, col2)
			b.Transparency = NumberSequence.new(1)
			b.Enabled = false
			b.Parent = base
			beams[i] = b
		end
		aurora.curtains[c] = { atts = atts, beams = beams, x0 = {} }
		for i, a in ipairs(atts) do
			aurora.curtains[c].x0[i] = a.Position
		end
	end
end

local auroraVis = -1
local function updateAurora(vis: number, t: number)
	local on = vis > 0.02
	local apply = on and math.abs(vis - auroraVis) > 0.01
	for c, cur in ipairs(aurora.curtains) do
		for i, b in ipairs(cur.beams) do
			b.Enabled = on
			if on then
				-- края всего занавеса растворяются
				local e0 = (i == 1) and 1 or 0.35
				local e1 = (i == #cur.beams) and 1 or 0.35
				if apply then
					local m = 1 - vis * 0.75
					b.Transparency = NumberSequence.new({
						NumberSequenceKeypoint.new(0, math.max(e0, m)),
						NumberSequenceKeypoint.new(0.5, m),
						NumberSequenceKeypoint.new(1, math.max(e1, m)),
					})
				end
				local w = math.sin(t * 0.23 + i * 0.9 + c * 1.7)
				b.CurveSize0 = 160 * w
				b.CurveSize1 = -140 * math.sin(t * 0.19 + i * 1.1 + c)
			end
		end
		if on then
			for i, a in ipairs(cur.atts) do
				local p = cur.x0[i]
				a.Position = p
					+ Vector3.new(0, 60 * math.sin(t * 0.17 + i * 0.7 + c), 140 * math.sin(t * 0.11 + i * 0.5 + c * 2.3))
			end
		end
	end
	if apply then
		auroraVis = vis
	end
end

-- ===== светлячки =====

local ffFolder = FX.localFolder("Fireflies")
local ffEmitters = {} -- [ключ] = {part, emitter}
local bboxCache = setmetatable({}, { __mode = "k" })

local function makeEmitter(parent: Instance): ParticleEmitter
	local cfg = Night.FIREFLIES
	local e = Instance.new("ParticleEmitter")
	e.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	e.Color = ColorSequence.new(cfg.COLOR[1], cfg.COLOR[2])
	e.LightEmission = 1
	e.LightInfluence = 0
	e.Brightness = 3
	e.Size = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 0),
		NumberSequenceKeypoint.new(0.15, 0.32),
		NumberSequenceKeypoint.new(0.5, 0.2),
		NumberSequenceKeypoint.new(0.85, 0.34),
		NumberSequenceKeypoint.new(1, 0),
	})
	e.Transparency = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 1),
		NumberSequenceKeypoint.new(0.2, 0.1),
		NumberSequenceKeypoint.new(0.45, 0.6),
		NumberSequenceKeypoint.new(0.7, 0.05),
		NumberSequenceKeypoint.new(1, 1),
	})
	e.Lifetime = NumberRange.new(4, 7)
	e.Speed = NumberRange.new(0.6, 1.8)
	e.SpreadAngle = Vector2.new(180, 180)
	e.Acceleration = Vector3.new(0, 0.3, 0)
	e.RotSpeed = NumberRange.new(-30, 30)
	e.Drag = 0.4
	e.Shape = Enum.ParticleEmitterShape.Box
	e.ShapeStyle = Enum.ParticleEmitterShapeStyle.Volume
	e.Rate = 0
	e.Parent = parent
	return e
end

local function islandModels()
	local list = {}
	local wa = workspace:FindFirstChild("Archipelago")
	local islands = wa and wa:FindFirstChild("Islands")
	if not islands then
		return list
	end
	for _, regionFolder in ipairs(islands:GetChildren()) do
		for _, m in ipairs(regionFolder:GetChildren()) do
			if m:IsA("Model") then
				table.insert(list, m)
			end
		end
	end
	return list
end

-- рамка острова; при подгрузке (StreamingEnabled) остров приходит частями — пересчёт раз в 10 с,
-- пустую рамку (ничего ещё не пришло) не запоминаем
local function bbox(m: Model)
	local c = bboxCache[m]
	local now = os.clock()
	if c and m.Parent and now - c[3] < 10 then
		return c[1], c[2]
	end
	local ok, cf, size = pcall(m.GetBoundingBox, m)
	if not ok or size.Magnitude < 1 then
		bboxCache[m] = nil
		return nil, nil
	end
	bboxCache[m] = { cf, size, now }
	return cf, size
end

local function regionOf(pos: Vector3)
	if World.regionAt then
		local ok, r = pcall(World.regionAt, pos)
		if ok then
			return r
		end
	end
	return nil
end

local function refreshFireflies(nightK: number)
	local cfg = Night.FIREFLIES
	local want = {}
	if nightK > 0.05 then
		local cam = FX.camPos()
		local cands = {}
		for _, m in ipairs(islandModels()) do
			local cf, size = bbox(m)
			if cf then
				local d = (cf.Position - cam).Magnitude
				if d < cfg.RANGE + size.Magnitude * 0.5 then
					local r = regionOf(cf.Position)
					if r and cfg.REGIONS[r] then
						table.insert(cands, { m = m, d = d, cf = cf, size = size })
					end
				end
			end
		end
		table.sort(cands, function(a, b)
			return a.d < b.d
		end)
		for i = 1, math.min(#cands, cfg.MAX_ISLANDS) do
			want[cands[i].m] = cands[i]
		end
		for _, p in ipairs(CollectionService:GetTagged("ArchFireflies")) do
			if p:IsA("BasePart") and (p.Position - cam).Magnitude < cfg.RANGE then
				want[p] = { tagged = true }
			end
		end
	end
	-- убрать лишние
	for key, rec in pairs(ffEmitters) do
		if not want[key] then
			if rec.part then
				rec.part:Destroy()
			else
				rec.emitter:Destroy()
			end
			ffEmitters[key] = nil
		end
	end
	-- добавить новые и подвинуть старые (рамка могла уточниться при подгрузке)
	for key, info in pairs(want) do
		local rec = ffEmitters[key]
		if info.tagged then
			if not rec then
				ffEmitters[key] = { emitter = makeEmitter(key) }
			end
		else
			local top = info.cf.Position + Vector3.new(0, info.size.Y * 0.5 + 10, 0)
			local size = Vector3.new(math.min(info.size.X * 0.8, 400), 18, math.min(info.size.Z * 0.8, 400))
			if not rec then
				local part = FX.part({
					Name = "FF_" .. key.Name,
					Transparency = 1,
					Size = size,
					CFrame = CFrame.new(top),
					Parent = ffFolder,
				})
				ffEmitters[key] = { part = part, emitter = makeEmitter(part) }
			elseif rec.part then
				rec.part.Size = size
				rec.part.CFrame = CFrame.new(top)
			end
		end
	end
	local rate = cfg.RATE * nightK * (0.4 + 0.6 * FX.quality())
	for _, rec in pairs(ffEmitters) do
		rec.emitter.Rate = rate
	end
end

-- ===== окна и фонари (теги) =====

local glowOrig = {} -- [part] = {mat, color}
local lightOrig = {} -- [light] = brightness

local function updateGlow(nightK: number)
	local onAt = Night.GLOW.ON_AT
	for _, p in ipairs(CollectionService:GetTagged("ArchNightGlow")) do
		if p:IsA("BasePart") then
			local o = glowOrig[p]
			if not o then
				o = { mat = p.Material, color = p.Color }
				glowOrig[p] = o
			end
			local glow = p:GetAttribute("GlowColor")
			if typeof(glow) ~= "Color3" then
				glow = Night.GLOW.DEFAULT
			end
			if nightK >= onAt then
				p.Material = Enum.Material.Neon
				p.Color = o.color:Lerp(glow, math.clamp((nightK - onAt) / (1 - onAt) + 0.4, 0, 1))
			else
				p.Material = o.mat
				p.Color = o.color
			end
		end
	end
	for _, l in ipairs(CollectionService:GetTagged("ArchNightLight")) do
		if l:IsA("Light") then
			local b = lightOrig[l]
			if not b then
				b = l.Brightness
				lightOrig[l] = b
			end
			l.Enabled = nightK > 0.25
			l.Brightness = b * nightK
		end
	end
end

CollectionService:GetInstanceRemovedSignal("ArchNightGlow"):Connect(function(p)
	glowOrig[p] = nil
end)
CollectionService:GetInstanceRemovedSignal("ArchNightLight"):Connect(function(l)
	lightOrig[l] = nil
end)

-- ===== закатный остров: проявление и растворение =====

local function sunsetParts(inst: Instance)
	local list = {}
	if inst:IsA("BasePart") then
		table.insert(list, inst)
	end
	for _, d in ipairs(inst:GetDescendants()) do
		if d:IsA("BasePart") then
			table.insert(list, d)
		end
	end
	return list
end

local function fadeSunset(inst: Instance, show: boolean)
	local dur = Night.SUNSET.FADE
	for _, p in ipairs(sunsetParts(inst)) do
		p.LocalTransparencyModifier = show and 1 or 0
		TweenService:Create(
			p,
			TweenInfo.new(dur, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut),
			{ LocalTransparencyModifier = show and 0 or 1 }
		):Play()
	end
	if show and FX.inWorld() then
		local pos
		if inst:IsA("Model") then
			pos = inst:GetPivot().Position
		elseif inst:IsA("BasePart") then
			pos = inst.Position
		end
		if pos and (pos - FX.camPos()).Magnitude < 1500 then
			FX.burst(pos + Vector3.new(0, 20, 0), Color3.fromRGB(255, 190, 120), 60, 30, 4, true)
			FX.sound(Ambience.OK.CHIME[1], pos, { volume = 0.9, speed = 0.8, range = 1500, min = 80 })
		end
	end
end

CollectionService:GetInstanceAddedSignal("ArchSunsetOnly"):Connect(function(inst)
	if inst:IsDescendantOf(workspace) then
		fadeSunset(inst, true)
	end
end)

local State = Clock.State
State:GetAttributeChangedSignal("SunsetIsland"):Connect(function()
	local v = State:GetAttribute("SunsetIsland")
	for _, inst in ipairs(CollectionService:GetTagged("ArchSunsetOnly")) do
		if inst:IsDescendantOf(workspace) then
			if v == false then
				fadeSunset(inst, false)
			elseif v == true then
				-- закат вернули, пока остров ещё не спрятан: проявить от текущей прозрачности
				for _, p in ipairs(sunsetParts(inst)) do
					if p.LocalTransparencyModifier > 0 then
						TweenService:Create(
							p,
							TweenInfo.new(Night.SUNSET.FADE, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut),
							{ LocalTransparencyModifier = 0 }
						):Play()
					end
				end
			end
		end
	end
end)

-- ===== главный цикл =====

local slowAt = 0
RunService.RenderStepped:Connect(function()
	local t = os.clock()
	local info = Clock.day()
	updateLight(info)

	local inWorld = FX.inWorld()
	local nightK = inWorld and info.night or 0

	-- небо: ночью, ярче на высоте, тусклее в облачность
	local camY = FX.camPos().Y - ORIGIN.Y
	local alt = WorldMath.smooth(-200, 2500, camY)
	local overcast = Clock.overcast()
	local storm = 0
	if nightK > 0 then
		storm = Clock.stormAt(FX.camPos())
	end
	local vis = nightK * (0.55 + 0.45 * alt) * (1 - 0.8 * math.max(overcast * 0.7, storm))
	if camY < -500 then
		vis = 0 -- под облачным морем неба не видно
	end
	updateSky(vis, t)

	local auroraK = inWorld and math.max(info.night, Night.AURORA.DUSK * info.sunset) or 0
	updateAurora(auroraK * (1 - 0.7 * overcast), t)

	if t - slowAt > 1 then
		slowAt = t
		refreshFireflies(nightK)
		updateGlow(inWorld and info.night or 0)
	end
end)

player:GetAttributeChangedSignal("WorldAccess"):Connect(function()
	if not FX.hasAccess() then
		setLayer(false)
	end
end)

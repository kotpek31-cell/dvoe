--!nonstrict
-- WeatherClient — погода у игрока: слой "weather" (LightingDirector), стена грозы с молниями внутри,
-- вспышки облачного моря, дождь/метель у камеры, удары молний (предупреждение → удар → гром),
-- порывы, радуга, дрожь течений (Flows.jitter). Только для тех, кто в мире.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Lighting = game:GetService("Lighting")
local Debris = game:GetService("Debris")

local Arch = ReplicatedStorage:WaitForChild("Archipelago")
local ConfigF = Arch:WaitForChild("Config")
local FX = require(Arch:WaitForChild("WorldFX"))
local WC = require(ConfigF:WaitForChild("WeatherCycle"))
local Ambience = require(ConfigF:WaitForChild("Ambience"))
local Clock = FX.Clock
local WorldMath = Clock.Math
local Director = FX.Director

local Flows
pcall(function()
	Flows = require(Arch:WaitForChild("Flows", 10))
end)

local player = Players.LocalPlayer
local ORIGIN = Clock.ORIGIN
local LZ = WC.LIGHTNING
local rng = Random.new()

local folder = FX.localFolder("Weather")

-- ===== свет погоды =====

local flashK = 0 -- 0..1, вспышка молнии рядом (гаснет быстро)
local layerW = -1

local function blend(a, b, t)
	local out = {}
	for k, v in pairs(a) do
		local w = b[k]
		if w == nil then
			out[k] = v
		elseif typeof(v) == "number" then
			out[k] = v + (w - v) * t
		elseif typeof(v) == "Color3" then
			out[k] = v:Lerp(w, t)
		else
			out[k] = (t < 0.5) and v or w
		end
	end
	for k, w in pairs(b) do
		if out[k] == nil then
			out[k] = w
		end
	end
	return out
end

local snowK, lightClock = 0, os.clock() -- плавный переход гроза ↔ метель на границе Льда

local function updateLight(I: number, snow: boolean, overcast: number)
	if not Director then
		return
	end
	if not FX.hasAccess() then
		if layerW ~= 0 then
			layerW = 0
			pcall(Director.weight, "weather", 0, 1)
		end
		return
	end
	local L = WC.LIGHT
	local c = os.clock()
	local dtL = math.min(c - lightClock, 0.5)
	lightClock = c
	snowK += math.clamp((snow and 1 or 0) - snowK, -dtL / 3, dtL / 3)
	local heavy = blend(L.storm, L.snow, snowK)
	local props = blend(L.cloudy, heavy, math.clamp(I * 1.2, 0, 1))
	local w = math.max(overcast * L.CLOUDY_WEIGHT, I)
	-- значения погоды дневные: ночью темнее (иначе облачная ночь светлее полудня)
	local nk = Clock.day().night
	if nk > 0.001 then
		local dk = 0.55 * nk
		props["Lighting.Brightness"] = (props["Lighting.Brightness"] or 1) * (1 - 0.5 * nk)
		for _, key in ipairs({ "Lighting.OutdoorAmbient", "Atmosphere.Color", "Atmosphere.Decay" }) do
			local col = props[key]
			if typeof(col) == "Color3" then
				props[key] = col:Lerp(Color3.new(0, 0, 0), dk)
			end
		end
	end
	if flashK > 0.001 then
		props["Lighting.Brightness"] = (props["Lighting.Brightness"] or 1) + L.FLASH_BRIGHTNESS * flashK
		props["Grade.Brightness"] = (props["Grade.Brightness"] or 0) + 0.22 * flashK
		props["Lighting.OutdoorAmbient"] = (props["Lighting.OutdoorAmbient"] or Color3.new(0.5, 0.5, 0.5))
			:Lerp(Color3.fromRGB(210, 210, 255), flashK)
		w = math.max(w, flashK)
	end
	pcall(Director.set, "weather", props)
	if math.abs(w - layerW) > 0.01 then
		layerW = w
		pcall(Director.weight, "weather", w, flashK > 0.001 and 0.02 or L.FADE)
	end
end

-- ===== стена грозы =====

local wall = nil -- {parts, rel, base, sizes, flash}

local function buildWall(f)
	local W = WC.WALL
	local model = Instance.new("Model")
	model.Name = "StormWall"
	local parts, rel, sizes, colors = {}, {}, {}, {}
	local r = Random.new(f.seed)
	for layer = 1, 2 do
		local uBase = (layer == 1) and 0.42 or -0.05 -- передняя кромка плотнее
		for ri, y in ipairs(W.ROWS) do
			local cols = (layer == 1) and W.COLS or math.floor(W.COLS * 0.6)
			for c = 1, cols do
				local v = (-0.5 + (c - 0.5) / cols) + r:NextNumber(-0.25, 0.25) / cols
				local u = uBase + r:NextNumber(-0.12, 0.12)
				local size = r:NextNumber(W.PUFF[1], W.PUFF[2]) * (ri == #W.ROWS and 0.85 or 1)
				local p = FX.part({
					Name = "Puff",
					Shape = Enum.PartType.Ball,
					Size = Vector3.new(size, size, size),
					Color = W.COLOR:Lerp(W.COLOR_TOP, (ri - 1) / math.max(#W.ROWS - 1, 1)),
					Material = Enum.Material.SmoothPlastic,
					Transparency = 1,
					Parent = model,
				})
				table.insert(parts, p)
				table.insert(colors, p.Color)
				table.insert(rel, { u = u, v = v, y = y + r:NextNumber(-60, 60), ph = r:NextNumber(0, 6.28) })
				table.insert(sizes, size)
			end
		end
	end
	local sea = FX.part({
		Name = "SeaFlash",
		Size = Vector3.new(1600, 2, 1600),
		Color = W.SEA_FLASH,
		Material = Enum.Material.Neon,
		Transparency = 1,
		Parent = model,
	})
	model.Parent = folder
	return { model = model, parts = parts, rel = rel, sizes = sizes, colors = colors, sea = sea, seed = f.seed, cfs = table.create(#parts) }
end

local function destroyWall()
	if wall then
		wall.model:Destroy()
		wall = nil
	end
end

-- вспышка внутри тучи: несколько облаков на миг становятся Neon
local function cloudFlash(n: number)
	if not wall then
		return
	end
	local W = WC.WALL
	for _ = 1, n do
		local i = rng:NextInteger(1, #wall.parts)
		local p = wall.parts[i]
		local orig = wall.colors[i] -- настоящий цвет (не текущий: вспышки могут перекрываться)
		local seq = { 0.07, 0.05, 0.11 }
		task.spawn(function()
			for k, d in ipairs(seq) do
				if not p.Parent then
					return
				end
				local on = (k % 2 == 1)
				p.Material = on and Enum.Material.Neon or Enum.Material.SmoothPlastic
				p.Color = on and W.FLASH or orig
				task.wait(d)
			end
			if p.Parent then
				p.Material = Enum.Material.SmoothPlastic
				p.Color = orig
			end
		end)
	end
	-- море под тучей вспыхивает изнутри
	local sea = wall.sea
	sea.Transparency = 0.72
	task.delay(0.09, function()
		if sea.Parent then
			sea.Transparency = 0.86
		end
	end)
	task.delay(0.2, function()
		if sea.Parent then
			sea.Transparency = 1
		end
	end)
end

local nextInnerFlash = 0
local function updateWall(f, t: number, cam: Vector3)
	if not f then
		destroyWall()
		return
	end
	if wall and wall.seed ~= f.seed then
		destroyWall()
	end
	if not wall then
		wall = buildWall(f)
	end
	local env = WorldMath.frontEnvelope(f, t)
	local cx, cz = WorldMath.frontCenter(f, t)
	local W = WC.WALL
	local nearA, nearB = W.NEAR_FADE[1], W.NEAR_FADE[2]
	local baseT = 1 - math.clamp(env, 0, 1) * 0.94
	for i, p in ipairs(wall.parts) do
		local r = wall.rel[i]
		local u = r.u * f.depth
		local v = r.v * f.width
		local x = cx + f.dx * u - f.dz * v
		local z = cz + f.dz * u + f.dx * v
		local y = ORIGIN.Y + r.y + math.sin(t * 0.07 + r.ph) * 25
		local pos = Vector3.new(x, y, z)
		wall.cfs[i] = CFrame.new(pos)
		local d = (pos - cam).Magnitude - wall.sizes[i] * 0.5
		local near = 1 - WorldMath.smooth(nearA, nearB, d)
		p.Transparency = baseT
		p.LocalTransparencyModifier = near
	end
	workspace:BulkMoveTo(wall.parts, wall.cfs, Enum.BulkMoveMode.FireCFrameChanged)
	wall.sea.CFrame = CFrame.new(cx, ORIGIN.Y + LZ.SEA_Y + 3, cz)

	-- молнии внутри тучи (только для красоты, удары — с сервера)
	if WorldMath.frontLightning(f, t) > 0 and t >= nextInnerFlash then
		nextInnerFlash = t + rng:NextNumber(0.6, 2.2)
		cloudFlash(rng:NextInteger(1, 3))
	end
end

-- ===== осадки у камеры =====

local precip = {}

local function makePrecip(kind: string)
	local cfg = (kind == "snow") and WC.SNOW_FX or WC.RAIN_FX
	local box = FX.part({
		Name = (kind == "snow") and "Snow" or "Rain",
		Transparency = 1,
		Size = Vector3.new(cfg.BOX, 2, cfg.BOX),
		Parent = folder,
	})
	local e = Instance.new("ParticleEmitter")
	e.Texture = cfg.TEXTURE
	e.Color = ColorSequence.new(cfg.COLOR)
	e.LightInfluence = 0.6
	e.LightEmission = (kind == "snow") and 0.2 or 0.35
	e.Shape = Enum.ParticleEmitterShape.Box
	e.ShapeStyle = Enum.ParticleEmitterShapeStyle.Volume
	e.EmissionDirection = Enum.NormalId.Bottom
	e.Speed = NumberRange.new(cfg.SPEED[1], cfg.SPEED[2])
	e.Rate = 0
	if kind == "snow" then
		e.Size = NumberSequence.new(0.35, 0.22)
		e.Lifetime = NumberRange.new(3.5, 5)
		e.SpreadAngle = Vector2.new(35, 35)
		e.RotSpeed = NumberRange.new(-120, 120)
		e.Transparency = NumberSequence.new({
			NumberSequenceKeypoint.new(0, 1),
			NumberSequenceKeypoint.new(0.15, 0.1),
			NumberSequenceKeypoint.new(1, 0.6),
		})
	else
		e.Size = NumberSequence.new(0.14)
		e.Squash = NumberSequence.new(2.6) -- тянем в полосы
		e.Orientation = Enum.ParticleOrientation.VelocityParallel
		e.Lifetime = NumberRange.new(0.9, 1.2)
		e.SpreadAngle = Vector2.new(4, 4)
		e.Transparency = NumberSequence.new({
			NumberSequenceKeypoint.new(0, 1),
			NumberSequenceKeypoint.new(0.1, 0.35),
			NumberSequenceKeypoint.new(1, 0.5),
		})
	end
	e.Parent = box
	return { box = box, e = e, cfg = cfg }
end

precip.rain = makePrecip("rain")
precip.snow = makePrecip("snow")

-- звук осадков (петли)
local function loop(id, fallback)
	if id and id ~= 0 then
		return FX.sound(id, nil, { looped = true, volume = 0 }), 1
	end
	local s = FX.sound(fallback.id, nil, { looped = true, volume = 0, speed = fallback.speed })
	return s, fallback.volume or 0.5
end
local rainSnd, rainVol = loop(Ambience.RAIN_LOOP, Ambience.STORM_WIND_FALLBACK)
local snowSnd, snowVol = loop(Ambience.BLIZZARD_LOOP, Ambience.STORM_WIND_FALLBACK)

local function setLoop(s: Sound?, vol: number)
	if not s then
		return
	end
	if vol > 0.01 then
		if not s.IsPlaying then
			s:Play()
		end
		s.Volume = vol
	elseif s.IsPlaying then
		s.Volume = 0
		s:Stop()
	end
end

local function updatePrecip(I: number, snow: boolean, cam: Vector3, camLook: Vector3)
	local q = 0.35 + 0.65 * FX.quality()
	local under = cam.Y < ORIGIN.Y + LZ.SEA_Y
	for kind, p in pairs(precip) do
		local k = (not under and ((kind == "snow") == snow)) and I or 0
		p.e.Rate = p.cfg.RATE * k * q
		-- коробка над камерой, чуть вперёд по взгляду (летим — капли навстречу)
		local ahead = Vector3.new(camLook.X, 0, camLook.Z) * (p.cfg.BOX * 0.25)
		p.box.CFrame = CFrame.new(cam + ahead + Vector3.new(0, (kind == "snow") and 45 or 70, 0))
		if kind == "snow" then
			local wind = p.cfg.WIND * (0.6 + 0.4 * math.sin(os.clock() * 0.7))
			p.e.Acceleration = Vector3.new(wind, -4, wind * 0.4)
		end
	end
	setLoop(rainSnd, (not snow) and I * rainVol or 0)
	setLoop(snowSnd, snow and I * snowVol or 0)
end

-- ===== удары молний =====

local function boltPath(top: Vector3, bottom: Vector3, segs: number, wild: number)
	local pts = { top }
	for i = 1, segs - 1 do
		local k = i / segs
		local p = top:Lerp(bottom, k)
		local j = wild * math.sin(k * math.pi) + wild * 0.25
		table.insert(pts, p + Vector3.new(rng:NextNumber(-j, j), rng:NextNumber(-j * 0.2, j * 0.2), rng:NextNumber(-j, j)))
	end
	table.insert(pts, bottom)
	return pts
end

local function drawBolt(pts, width: number, parent: Instance)
	local parts = {}
	for i = 1, #pts - 1 do
		local a, b = pts[i], pts[i + 1]
		local len = (b - a).Magnitude
		local cf = CFrame.lookAt((a + b) / 2, b)
		local core = FX.part({
			Name = "Bolt",
			Size = Vector3.new(width, width, len),
			CFrame = cf,
			Color = Color3.fromRGB(245, 245, 255),
			Material = Enum.Material.Neon,
			Parent = parent,
		})
		local glow = FX.part({
			Name = "BoltGlow",
			Size = Vector3.new(width * 4, width * 4, len),
			CFrame = cf,
			Color = Color3.fromRGB(170, 150, 255),
			Material = Enum.Material.Neon,
			Transparency = 0.72,
			Parent = parent,
		})
		table.insert(parts, core)
		table.insert(parts, glow)
	end
	return parts
end

local function telegraph(pos: Vector3, groundY: number, tStrike: number)
	local holder = Instance.new("Model")
	holder.Name = "StrikeWarn"
	holder.Parent = folder
	-- свечение в туче
	local orb = FX.part({
		Name = "CloudGlow",
		Shape = Enum.PartType.Ball,
		Size = Vector3.new(60, 60, 60),
		CFrame = CFrame.new(pos + Vector3.new(0, LZ.BOLT_HEIGHT * 0.92, 0)),
		Color = Color3.fromRGB(190, 170, 255),
		Material = Enum.Material.Neon,
		Transparency = 0.9,
		Parent = holder,
	})
	-- круг на земле (там, куда ударит)
	local ring = FX.part({
		Name = "GroundWarn",
		Shape = Enum.PartType.Cylinder,
		Size = Vector3.new(0.3, 2, 2),
		CFrame = CFrame.new(pos.X, groundY + 0.25, pos.Z) * CFrame.Angles(0, 0, math.rad(90)),
		Color = Color3.fromRGB(200, 185, 255),
		Material = Enum.Material.Neon,
		Transparency = 0.6,
		Parent = holder,
	})
	local light = Instance.new("PointLight")
	light.Color = Color3.fromRGB(190, 170, 255)
	light.Range = 40
	light.Brightness = 0
	light.Parent = ring
	FX.soundOr(Ambience.CRACKLE, { { id = Ambience.OK.CHIME[2], speed = 0.45, volume = 0.7 } }, pos, { range = 500, min = 30 })

	local t0 = workspace:GetServerTimeNow()
	local conn
	conn = RunService.RenderStepped:Connect(function()
		local now = workspace:GetServerTimeNow()
		local k = math.clamp((now - t0) / math.max(tStrike - t0, 0.05), 0, 1)
		if now >= tStrike or not holder.Parent then
			conn:Disconnect()
			holder:Destroy()
			return
		end
		local flick = 0.5 + 0.5 * math.sin(now * 40)
		orb.Transparency = 0.9 - 0.45 * k * flick
		local r = 4 + 12 * k
		ring.Size = Vector3.new(0.3, r * 2, r * 2)
		ring.Transparency = 0.75 - 0.4 * k
		light.Brightness = 3 * k
	end)
end

local function thunder(pos: Vector3)
	local d = (pos - FX.camPos()).Magnitude
	local delay = math.clamp(d / 1100, 0.05, 4)
	local vol = math.clamp(1.4 - d / 2600, 0.25, 1.4)
	task.delay(delay, function()
		FX.soundOr(Ambience.THUNDER, Ambience.THUNDER_FALLBACK, nil, { volume = vol, life = 8 })
	end)
end

local function strike(pos: Vector3, groundY: number, seed: number)
	local cam = FX.camPos()
	local d = (pos - cam).Magnitude
	local holder = Instance.new("Model")
	holder.Name = "Strike"
	holder.Parent = folder
	rng = Random.new(seed)
	local top = pos + Vector3.new(rng:NextNumber(-40, 40), LZ.BOLT_HEIGHT, rng:NextNumber(-40, 40))
	local bottom = Vector3.new(pos.X, groundY, pos.Z)
	local main = boltPath(top, pos, 13, 26)
	if pos.Y > groundY + 6 then
		-- удар в воздухе: молния проходит через точку и уходит вниз
		local tail = boltPath(pos, bottom, 6, 14)
		for i = 2, #tail do
			table.insert(main, tail[i])
		end
	end
	local parts = drawBolt(main, 1.1, holder)
	-- ветки
	for _ = 1, 3 do
		local from = main[rng:NextInteger(3, math.max(3, #main - 3))]
		local to = from + Vector3.new(rng:NextNumber(-90, 90), -rng:NextNumber(60, 160), rng:NextNumber(-90, 90))
		for _, p in ipairs(drawBolt(boltPath(from, to, 5, 18), 0.55, holder)) do
			table.insert(parts, p)
		end
	end
	-- мигание: вкл — выкл — вкл, потом гаснет
	task.spawn(function()
		local seq = { { 0.06, true }, { 0.05, false }, { 0.1, true } }
		for _, s in ipairs(seq) do
			for _, p in ipairs(parts) do
				p.LocalTransparencyModifier = s[2] and 0 or 1
			end
			task.wait(s[1])
		end
		local t0 = os.clock()
		while os.clock() - t0 < 0.28 do
			local k = (os.clock() - t0) / 0.28
			for _, p in ipairs(parts) do
				p.LocalTransparencyModifier = k
			end
			RunService.RenderStepped:Wait()
		end
		holder:Destroy()
	end)

	-- удар о землю (не о море)
	local impact = bottom
	if groundY > ORIGIN.Y + LZ.SEA_Y + 2 then
		FX.ring(impact, 3, 34, 0.55, Color3.fromRGB(200, 185, 255), 2, 1.4)
		FX.burst(impact + Vector3.new(0, 2, 0), Color3.fromRGB(220, 210, 255), 40, 45, 1.2, true)
		FX.burst(impact, Color3.fromRGB(80, 76, 96), 14, 14, 6, false)
		-- обожжённое пятно
		local scorch = FX.part({
			Name = "Scorch",
			Shape = Enum.PartType.Cylinder,
			Size = Vector3.new(0.2, 14, 14),
			CFrame = CFrame.new(impact + Vector3.new(0, 0.12, 0)) * CFrame.Angles(0, 0, math.rad(90)),
			Color = Color3.fromRGB(40, 36, 50),
			Material = Enum.Material.SmoothPlastic,
			Transparency = 0.35,
			Parent = folder,
		})
		Debris:AddItem(scorch, 6)
	end
	FX.light(impact + Vector3.new(0, 6, 0), Color3.fromRGB(205, 195, 255), 60, 12, 0.5)

	-- вспышка неба по расстоянию, тинт и тряска рядом
	flashK = math.max(flashK, math.clamp(1 - d / 1600, 0, 1))
	if d < 140 then
		FX.flash(Color3.fromRGB(205, 200, 255), 0.8, 0.45)
	end
	FX.shakeAt(pos, 2.4, 300, 0.6)
	cloudFlash(3)
	thunder(pos)
end

local remote = Arch:WaitForChild("Remotes"):WaitForChild("Weather", 30)
if remote then
	remote.OnClientEvent:Connect(function(kind, a, b, c, d)
		if kind == "strike" then
			if not FX.inWorld() then
				return
			end
			local pos, groundY, tStrike, seed = a, b, c, d
			if typeof(pos) ~= "Vector3" then
				return
			end
			if (pos - FX.camPos()).Magnitude > 4500 then
				-- далеко: только гром и вспышка в туче
				task.delay(math.max(0, tStrike - workspace:GetServerTimeNow()), function()
					cloudFlash(2)
					thunder(pos)
				end)
				return
			end
			telegraph(pos, groundY, tStrike)
			task.delay(math.max(0, tStrike - workspace:GetServerTimeNow()), function()
				strike(pos, groundY, seed or 1)
			end)
		elseif kind == "knock" and typeof(a) == "Vector3" then
			FX.knock(a)
			FX.shake(2.2, 0.45)
			FX.sound(Ambience.OK.WHOOSH[2], nil, { volume = 0.7, speed = 0.8 })
		end
	end)
end

-- ===== порывы (иногда выбивают из течения) =====

local nextGust = 0
local function updateGust(I: number, snow: boolean, t: number)
	local G = WC.GUST
	if I < G.MIN_STORM then
		return
	end
	local char = player.Character
	if not char or char:GetAttribute("FlightState") ~= "Wings" then
		return
	end
	if t < nextGust then
		return
	end
	nextGust = t + rng:NextNumber(G.EVERY[1], G.EVERY[2])
	if rng:NextNumber() > G.CHANCE then
		return
	end
	local hrp = char:FindFirstChild("HumanoidRootPart")
	if not hrp then
		return
	end
	local look = hrp.CFrame.LookVector
	local side = Vector3.new(-look.Z, 0, look.X)
	if side.Magnitude < 0.1 then
		side = Vector3.new(1, 0, 0)
	end
	local dir = side.Unit * (rng:NextNumber() < 0.5 and -1 or 1)
	local power = snow and G.SNOW_POWER or G.POWER
	FX.knock(dir * power * I + Vector3.new(0, -power * 0.15, 0))
	FX.shake(1.4, 0.5, 9)
	FX.sound(Ambience.OK.WHOOSH[3], nil, { volume = 0.8, speed = 0.7 })
	FX.burst(hrp.Position - dir * 6, Color3.fromRGB(220, 230, 255), 22, 60, 1.5, false)
end

-- ===== радуга =====

local rainbow = nil
local function buildRainbow()
	local R = WC.RAINBOW
	local base = FX.part({ Name = "Rainbow", Transparency = 1, Size = Vector3.new(1, 1, 1), Parent = folder })
	local bands = {}
	local SEG = 16
	for b, col in ipairs(R.COLORS) do
		local atts, beams = {}, {}
		for i = 0, SEG do
			local a = Instance.new("Attachment")
			a.Parent = base
			atts[i] = a
		end
		for i = 1, SEG do
			local bm = Instance.new("Beam")
			bm.Attachment0 = atts[i - 1]
			bm.Attachment1 = atts[i]
			bm.FaceCamera = true
			bm.Width0 = R.BAND * 1.08
			bm.Width1 = R.BAND * 1.08
			bm.Color = ColorSequence.new(col)
			bm.LightEmission = 0.6
			bm.LightInfluence = 0
			bm.Transparency = NumberSequence.new(1)
			bm.Parent = base
			beams[i] = bm
		end
		bands[b] = { atts = atts, beams = beams }
	end
	return { base = base, bands = bands, seg = SEG, vis = -1 }
end

local function updateRainbow(k: number, cam: Vector3)
	if k <= 0.01 then
		if rainbow then
			rainbow.base:Destroy()
			rainbow = nil
		end
		return
	end
	if not rainbow then
		rainbow = buildRainbow()
	end
	local R = WC.RAINBOW
	local sun = Lighting:GetSunDirection()
	local anti = Vector3.new(-sun.X, 0, -sun.Z)
	if anti.Magnitude < 0.1 then
		anti = Vector3.new(0, 0, 1)
	end
	anti = anti.Unit
	local right = anti:Cross(Vector3.yAxis).Unit
	local center = cam + anti * R.DIST - Vector3.new(0, R.RADIUS * 0.22, 0)
	rainbow.base.CFrame = CFrame.new(center)
	-- сравниваем с ПРИМЕНЁННОЙ видимостью: радуга проявляется медленно
	local upd = math.abs(k - rainbow.vis) > 0.01
	for b, band in ipairs(rainbow.bands) do
		local rad = R.RADIUS - (b - 1) * R.BAND
		for i = 0, rainbow.seg do
			local a = math.pi * i / rainbow.seg
			band.atts[i].Position = right * math.cos(a) * rad + Vector3.yAxis * math.sin(a) * rad
		end
		if upd then
			local tr = 1 - k * (1 - R.ALPHA)
			for i, bm in ipairs(band.beams) do
				local e0 = (i == 1) and 1 or tr
				local e1 = (i == #band.beams) and 1 or tr
				bm.Transparency = NumberSequence.new({
					NumberSequenceKeypoint.new(0, e0),
					NumberSequenceKeypoint.new(0.5, tr),
					NumberSequenceKeypoint.new(1, e1),
				})
			end
		end
	end
	if upd then
		rainbow.vis = k
	end
end

-- ===== главный цикл =====

local slowAt = 0
local I, snow = 0, false

RunService.RenderStepped:Connect(function(dt)
	local t = workspace:GetServerTimeNow()
	local cam = workspace.CurrentCamera
	if not cam then
		return
	end
	local camPos = cam.CFrame.Position
	local inWorld = FX.inWorld()
	local under = camPos.Y < ORIGIN.Y + LZ.SEA_Y -- под облачным морем — укрытие

	-- вспышка гаснет быстро
	if flashK > 0 then
		flashK = math.max(0, flashK - dt * 6)
	end

	local clockNow = os.clock()
	if clockNow - slowAt > 0.1 or flashK > 0 then
		slowAt = clockNow
		if inWorld and not under then
			local i2, s2 = Clock.stormAt(camPos, t)
			I, snow = i2, s2
		else
			I, snow = 0, false
		end
		updateLight(I, snow, inWorld and Clock.overcast(t) or 0)
		if Flows then
			Flows.jitter = Clock.jitter(t)
		end
	end

	if inWorld then
		updateWall(Clock.front(t), t, camPos)
		updatePrecip(I, snow, camPos, cam.CFrame.LookVector)
		updateGust(I, snow, t)
		-- радуга — только днём и не под облаками
		updateRainbow(under and 0 or Clock.rainbow(t) * (1 - Clock.day(t).night), camPos)
	else
		destroyWall()
		updatePrecip(0, false, camPos, cam.CFrame.LookVector)
		updateRainbow(0, camPos)
	end
end)

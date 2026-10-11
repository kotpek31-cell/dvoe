--!nonstrict
-- GuardianClient — Страж Храма у игрока: видимая модель (GuardianBuilder) поверх серверного хитбокса,
-- анимация пружинами по позам (замах → удар с перелётом → восстановление), телеграфы каждой атаки
-- на полу заранее, удары с волнами/обломками/пылью/светом, тряска и тинт рядом, звук слоями,
-- сцена-знакомство при первой встрече, полоса здоровья с фазами, награда и разрушение при победе.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local LocalizationService = game:GetService("LocalizationService")
local Debris = game:GetService("Debris")

local Arch = ReplicatedStorage:WaitForChild("Archipelago")
local ConfigF = Arch:WaitForChild("Config")
local FX = require(Arch:WaitForChild("WorldFX"))
local Cfg = require(ConfigF:WaitForChild("Guardian"))
local Ambience = require(ConfigF:WaitForChild("Ambience"))
local GB = require(Arch:WaitForChild("Assets"):WaitForChild("GuardianBuilder"))
local Clock = FX.Clock
local WorldMath = Clock.Math

local player = Players.LocalPlayer
local L = Cfg.LOOK
local A = Cfg.ATTACKS
local POSES = GB.POSES
local OK = Ambience.OK

local folder = FX.localFolder("Guardian")
local T_BASE = os.clock() -- для math.noise (float32)
local remote = Arch:WaitForChild("Remotes"):WaitForChild("Guardian", 30)

-- ===== текст (ru/en). TODO(studio): перевести на ключи модуля Text (как на этапе 3) =====

local TEXT = {
	ru = {
		name = Cfg.NAME,
		sub = Cfg.SUBTITLE,
		phase = "Фаза %d · %s",
		phases = Cfg.PHASE_NAMES,
		win = "СТРАЖ ПОВЕРЖЕН",
		shard = "+ осколок нимба",
		lore = "+ страница летописи",
		cosmetic = "+ «Каменное сердце»",
		again = "Награда — только за первую победу",
		skip = "Коснись, чтобы пропустить",
		back = "Страж вернётся через 10 минут",
	},
	en = {
		name = "Temple Guardian",
		sub = "keeper of the cracked halo",
		phase = "Phase %d · %s",
		phases = { "Stone", "Light", "Wrath" },
		win = "GUARDIAN DEFEATED",
		shard = "+ halo shard",
		lore = "+ chronicle page",
		cosmetic = "+ “Stone Heart”",
		again = "Rewards are for the first victory only",
		skip = "Tap to skip",
		back = "The Guardian returns in 10 minutes",
	},
}
local T = TEXT.en
do
	local ok, loc = pcall(function()
		return LocalizationService.RobloxLocaleId
	end)
	if ok and type(loc) == "string" and string.sub(string.lower(loc), 1, 2) == "ru" then
		T = TEXT.ru
	end
end

-- ===== звук =====

local SND = Cfg.SND
local function snd(id, fallback, where, opts)
	return FX.soundOr(id, fallback, where, opts)
end
local FB = {
	roar = { { id = OK.BOOM, speed = 0.42, volume = 1.4 }, { id = OK.CHOIR, speed = 0.55, volume = 0.9 }, { id = OK.HUM_LOOP, speed = 0.5, volume = 0.6 } },
	slam = { { id = OK.BOOM, speed = 0.7, volume = 1.3 }, { id = OK.BOOM_B, speed = 0.8, volume = 1.0 }, { id = OK.FALL[1], speed = 0.7, volume = 0.6 } },
	sweep = { { id = OK.WHOOSH[2], speed = 0.6, volume = 1.1 }, { id = OK.WHOOSH[1], speed = 0.7, volume = 0.7 } },
	quake = { { id = OK.BOOM, speed = 0.5, volume = 1.4 }, { id = OK.BOOM_B, speed = 0.55, volume = 1.2 } },
	rubble = { { id = OK.FALL[2], speed = 0.65, volume = 0.9 }, { id = OK.BOOM_B, speed = 0.95, volume = 0.6 } },
	crumble = { { id = OK.BOOM, speed = 0.35, volume = 1.5 }, { id = OK.FALL[1], speed = 0.5, volume = 1.0 }, { id = OK.CHOIR, speed = 0.8, volume = 1.0 } },
	wake = { { id = OK.CHOIR, speed = 0.7, volume = 0.9 }, { id = OK.HUM_LOOP, speed = 0.35, volume = 0.8 } },
	crack = { { id = OK.CHIME[1], speed = 0.6, volume = 1.0 }, { id = OK.CHIME[2], speed = 0.45, volume = 0.8 } },
	charge = { { id = OK.CHIME[2], speed = 0.5, volume = 0.6 }, { id = OK.HUM_LOOP, speed = 1.2, volume = 0.5 } },
}

-- ===== вид =====

local view = nil -- {server, rig, springs, ...}

local function serverModel(): Model?
	local wa = workspace:FindFirstChild("Archipelago")
	local g = wa and wa:FindFirstChild("Guardian")
	local m = g and g:FindFirstChild("TempleGuardian")
	if m and m:IsA("Model") and m:FindFirstChild("HumanoidRootPart") then
		return m
	end
	return nil
end

local function newSprings()
	local s = {}
	for _, b in ipairs(GB.BONES) do
		s[b[1]] = { { x = 0, v = 0 }, { x = 0, v = 0 }, { x = 0, v = 0 } }
	end
	s.rootY = { x = -4.2, v = 0 }
	s.haloUp = { x = -1.6, v = 0 }
	-- начинаем на коленях
	local k = POSES.kneel
	for name, a in pairs(k) do
		if type(a) == "table" and s[name] then
			for i = 1, 3 do
				s[name][i].x = math.rad(a[i])
			end
		end
	end
	return s
end

local function destroyView()
	if view then
		if view.act then
			for _, o in ipairs(view.act.objs) do
				o:Destroy()
			end
		end
		if view.beamSnd then
			view.beamSnd:Destroy()
		end
		if view.rig and view.rig.model.Parent and not view.crumbling then
			view.rig.model:Destroy()
		end
		view = nil
	end
end

local function buildView(m: Model)
	destroyView()
	local rig = GB.build(L, folder)
	view = {
		server = m,
		rig = rig,
		springs = newSprings(),
		yaw = 0,
		haloSpin = 0,
		phase = 0,
		state = "",
		act = nil,
		crumbling = false,
		hpShown = 1,
		chip = 1,
	}
	local root = m:FindFirstChild("HumanoidRootPart") :: BasePart?
	if root then
		local _, y = root.CFrame:ToEulerAnglesYXZ()
		view.yaw = y
	end
end

local function attr(k)
	return view and view.server:GetAttribute(k)
end

local function floorCF(): CFrame
	local arena = attr("GArena") or Vector3.zero
	return CFrame.new(arena) * CFrame.Angles(0, view.yaw, 0)
end

-- цвет свечения по фазе
local function glowColor(phase: number): Color3
	if phase >= 3 then
		return L.ANGRY
	elseif phase == 2 then
		return L.GLOW:Lerp(L.ANGRY, 0.25)
	end
	return L.GLOW
end

local function recolor(phase: number)
	local c = glowColor(phase)
	for _, p in ipairs(view.rig.glow) do
		p.Color = c
	end
	for _, l in ipairs(view.rig.lights) do
		l.Color = c
	end
	-- во 2-й фазе трещина нимба шире: гаснет ещё один кусок
	for _, h in ipairs(view.rig.halo) do
		local gone = (phase >= 2 and h.index == 7) or (phase >= 3 and h.index == 4)
		h.part.Transparency = gone and 1 or 0
	end
end

-- ===== выбор позы =====

local function poseFor(t: number)
	local st = attr("GState") or "dormant"
	if st == "dormant" then
		return POSES.kneel, 0
	elseif st == "intro" then
		local e = t - (attr("GIntroT0") or t)
		if e < 1.4 then
			return POSES.kneel, 1 - e / 1.4
		elseif e < 2.7 then
			return POSES.idle, 0
		elseif e < 3.6 then
			return POSES.roar, 0
		end
		return POSES.idle, 0
	elseif st == "transition" then
		local e = t - (attr("GTransT0") or t)
		if e > 0.3 and e < 2.6 then
			return POSES.roar, 0
		end
		return POSES.idle, 0
	elseif st == "fight" then
		local name = attr("GAct") or ""
		local def = A[name]
		if def then
			local e = t - (attr("GActT0") or t)
			if name == "slam" then
				return (e < def.windup) and POSES.slamWind or ((e < def.windup + 0.45) and POSES.slamHit or POSES.idle), 0
			elseif name == "sweep" then
				return (e < def.windup) and POSES.sweepWind or ((e < def.windup + 0.4) and POSES.sweepHit or POSES.idle), 0
			elseif name == "quake" then
				return (e < def.windup) and POSES.quakeWind or ((e < def.windup + 0.5) and POSES.quakeHit or POSES.idle), 0
			elseif name == "beams" then
				return (e < def.windup + def.duration) and POSES.beam or POSES.idle, 0
			elseif name == "rubble" then
				return (e < def.windup) and POSES.summon or ((e < def.windup + 0.4) and POSES.quakeHit or POSES.idle), 0
			end
		end
		return POSES.idle, 0
	end
	return POSES.idle, 0
end

-- ===== телеграфы и удары =====

local function flatPart(props)
	return FX.part(props)
end

-- плоский диск на полу (цилиндр лёжа)
local function disc(pos: Vector3, r: number, color: Color3, tr: number, parent: Instance): Part
	return flatPart({
		Name = "Disc",
		Shape = Enum.PartType.Cylinder,
		Size = Vector3.new(0.25, r * 2, r * 2),
		CFrame = CFrame.new(pos + Vector3.new(0, 0.18, 0)) * CFrame.Angles(0, 0, math.rad(90)),
		Color = color,
		Material = Enum.Material.Neon,
		Transparency = tr,
		Parent = parent,
	})
end

-- кольцо-контур на полу (неподвижное)
local function outline(pos: Vector3, r: number, color: Color3, thick: number, parent: Instance)
	local N = math.clamp(math.floor(r * 1.2), 16, 48)
	local list = {}
	for i = 1, N do
		local a = (i - 0.5) / N * math.pi * 2
		table.insert(list, flatPart({
			Name = "Edge",
			Size = Vector3.new(thick, 0.3, 2 * r * math.sin(math.pi / N) * 1.1),
			CFrame = CFrame.new(pos + Vector3.new(math.cos(a) * r, 0.3, math.sin(a) * r)) * CFrame.Angles(0, -a, 0),
			Color = color,
			Material = Enum.Material.Neon,
			Transparency = 0.25,
			Parent = parent,
		}))
	end
	return list
end

-- кольцо-стена с линейной скоростью (волна землетрясения: совпадает с сервером)
local function quakeWave(center: Vector3, tS: number, def, parent: Instance)
	local N = 40
	local parts = {}
	for i = 1, N do
		parts[i] = flatPart({
			Name = "Wave",
			Size = Vector3.new(def.width * 0.6, def.height, 2),
			Color = L.DANGER,
			Material = Enum.Material.Neon,
			Transparency = 0.15,
			Parent = parent,
		})
	end
	local cfs = table.create(N)
	local conn
	conn = RunService.RenderStepped:Connect(function()
		local r = def.speed * (workspace:GetServerTimeNow() - tS)
		if r > def.maxR or not parts[1].Parent then
			conn:Disconnect()
			for _, p in ipairs(parts) do
				p:Destroy()
			end
			return
		end
		if r < 0 then
			return
		end
		local chord = 2 * math.max(r, 1) * math.sin(math.pi / N) * 1.1
		local fade = WorldMath.smooth(def.maxR * 0.75, def.maxR, r)
		for i, p in ipairs(parts) do
			local a = (i - 0.5) / N * math.pi * 2
			cfs[i] = CFrame.new(center + Vector3.new(math.cos(a) * r, def.height * 0.5, math.sin(a) * r)) * CFrame.Angles(0, -a, 0)
			p.Size = Vector3.new(def.width * 0.6, def.height * (0.8 + 0.2 * math.sin(r * 0.3 + i)), chord)
			p.Transparency = 0.15 + 0.8 * fade
		end
		workspace:BulkMoveTo(parts, cfs, Enum.BulkMoveMode.FireCFrameChanged)
	end)
end

-- трещины на полу (неон, гаснут)
local function cracks(center: Vector3, n: number, len: number, color: Color3, life: number)
	local f = FX.localFolder("FX")
	for i = 1, n do
		local a = (i / n) * math.pi * 2 + math.random() * 0.4
		local l = len * (0.6 + math.random() * 0.5)
		local p = flatPart({
			Name = "Crack",
			Size = Vector3.new(0.5, 0.2, l),
			CFrame = CFrame.new(center + Vector3.new(math.cos(a) * l * 0.5, 0.2, math.sin(a) * l * 0.5)) * CFrame.Angles(0, -a + math.pi / 2, 0),
			Color = color,
			Material = Enum.Material.Neon,
			Parent = f,
		})
		TweenService:Create(p, TweenInfo.new(life, Enum.EasingStyle.Quad, Enum.EasingDirection.In), { Transparency = 1 }):Play()
		Debris:AddItem(p, life + 0.1)
	end
end

local function impact(spot: Vector3, ring: number, power: number)
	FX.ring(spot, 2, ring, 0.55, L.DANGER_SOFT, 2.6, 2.2)
	FX.ring(spot, 1, ring * 0.6, 0.35, Color3.new(1, 1, 1), 1.2, 1)
	FX.debris(spot + Vector3.new(0, 1, 0), 16, L.STONE, 55 * power, 1.7)
	FX.burst(spot + Vector3.new(0, 2, 0), Color3.fromRGB(220, 210, 200), 34, 26, 7, false)
	FX.burst(spot + Vector3.new(0, 1, 0), L.DANGER_SOFT, 26, 40, 1, true)
	FX.light(spot + Vector3.new(0, 5, 0), L.DANGER_SOFT, 50, 9, 0.6)
	cracks(spot, 7, ring * 0.8, L.DANGER_SOFT, 1.6)
	FX.shakeAt(spot, 4.2 * power, 170, 0.75)
end

local function endAct()
	local act = view and view.act
	if not act then
		return
	end
	for _, o in ipairs(act.objs) do
		if o.Parent then
			o:Destroy()
		end
	end
	if act.loop then
		act.loop:Destroy()
	end
	view.act = nil
end

local function startAct(n: number)
	endAct()
	local name = attr("GAct") or ""
	local def = A[name]
	if not def then
		return
	end
	local holder = Instance.new("Folder")
	holder.Name = "Act_" .. name
	holder.Parent = folder
	local act = {
		n = n,
		name = name,
		def = def,
		t0 = attr("GActT0") or workspace:GetServerTimeNow(),
		target = attr("GActTarget") or (attr("GArena") or Vector3.zero),
		dir = attr("GActDir") or view.yaw,
		count = attr("GActCount") or 3,
		sign = attr("GActSign") or 1,
		objs = { holder },
		holder = holder,
		done = {},
	}
	view.act = act
	local arena = attr("GArena") or Vector3.zero

	if name == "slam" then
		act.fill = disc(act.target, 0.5, L.DANGER, 0.7, holder)
		outline(act.target, def.radius, L.DANGER, 0.7, holder)
		local outer = outline(act.target, def.ring, L.DANGER_SOFT, 0.4, holder)
		for _, p in ipairs(outer) do
			p.Transparency = 0.6
		end
		local emb = Instance.new("ParticleEmitter")
		emb.Texture = "rbxasset://textures/particles/sparkles_main.dds"
		emb.Color = ColorSequence.new(L.DANGER_SOFT)
		emb.LightEmission = 1
		emb.Size = NumberSequence.new(0.5, 0)
		emb.Speed = NumberRange.new(4, 9)
		emb.Lifetime = NumberRange.new(0.6, 1)
		emb.SpreadAngle = Vector2.new(15, 15)
		emb.EmissionDirection = Enum.NormalId.Right
		emb.Rate = 40
		emb.Parent = act.fill
	elseif name == "sweep" then
		local half = math.rad(def.arc * 0.5)
		local blades = 11
		act.fan = {}
		for i = 1, blades do
			local a = act.dir - half + (i - 1) / (blades - 1) * half * 2
			local p = flatPart({
				Name = "Fan",
				Size = Vector3.new(2 * def.radius * math.sin(half / blades) * 1.4, 0.25, def.radius),
				CFrame = CFrame.new(arena + Vector3.new(0, 0.2, 0)) * CFrame.Angles(0, a, 0) * CFrame.new(0, 0, -def.radius * 0.5),
				Color = L.DANGER,
				Material = Enum.Material.Neon,
				Transparency = 0.9,
				Parent = holder,
			})
			table.insert(act.fan, p)
		end
	elseif name == "quake" then
		act.center = disc(arena, 6, L.DANGER, 0.5, holder)
		act.lines = {}
		for i = 1, 10 do
			local a = (i - 0.5) / 10 * math.pi * 2
			table.insert(act.lines, { a = a, p = flatPart({
				Name = "QuakeLine",
				Size = Vector3.new(0.6, 0.25, 1),
				Color = L.DANGER,
				Material = Enum.Material.Neon,
				Transparency = 0.3,
				Parent = holder,
			}) })
		end
	elseif name == "beams" then
		act.lines = {}
		act.beams = {}
		for i = 0, act.count - 1 do
			local line = flatPart({
				Name = "BeamWarn",
				Size = Vector3.new(0.35, 0.35, def.length),
				Color = L.BEAM,
				Material = Enum.Material.Neon,
				Transparency = 0.85,
				Parent = holder,
			})
			table.insert(act.lines, line)
		end
		act.orb = flatPart({
			Name = "Charge",
			Shape = Enum.PartType.Ball,
			Size = Vector3.new(1, 1, 1),
			Color = L.BEAM,
			Material = Enum.Material.Neon,
			Transparency = 0.2,
			Parent = holder,
		})
		snd(0, FB.charge, view.rig.core, { range = 260 })
	elseif name == "rubble" then
		snd(0, FB.roar, view.rig.core, { range = 300, volume = 0.5 })
	end
end

-- камнепад: точки пришли отдельным сообщением
local function rubbleSpots(spots, tFall: number)
	local def = A.rubble
	for _, spot in ipairs(spots) do
		local holder = Instance.new("Folder")
		holder.Name = "Rubble"
		holder.Parent = folder
		local shadow = disc(spot, 0.5, Color3.fromRGB(30, 26, 36), 0.4, holder)
		shadow.Material = Enum.Material.SmoothPlastic
		outline(spot, def.radius, L.DANGER, 0.5, holder)
		local rock = flatPart({
			Name = "Rock",
			Size = Vector3.new(def.radius * 0.9, def.radius * 0.75, def.radius * 0.85),
			Color = L.STONE_DARK,
			Material = Enum.Material.Slate,
			Transparency = 1,
			Parent = holder,
		})
		local rock2 = flatPart({
			Name = "Rock",
			Size = Vector3.new(def.radius * 0.6, def.radius * 0.6, def.radius * 0.7),
			Color = L.STONE,
			Material = Enum.Material.Marble,
			Transparency = 1,
			Parent = holder,
		})
		local glow = flatPart({
			Name = "RockGlow",
			Size = Vector3.new(0.4, def.radius * 0.5, 0.4),
			Color = L.GLOW,
			Material = Enum.Material.Neon,
			Transparency = 1,
			Parent = holder,
		})
		local spin = CFrame.Angles(math.random() * 6, math.random() * 6, math.random() * 6)
		local landed = false
		local conn
		conn = RunService.RenderStepped:Connect(function()
			if not holder.Parent or (view and attr("GFrozen") == true) then
				conn:Disconnect()
				holder:Destroy()
				return
			end
			local t = workspace:GetServerTimeNow()
			local left = tFall - t
			local k = 1 - math.clamp(left / def.windup, 0, 1)
			shadow.Size = Vector3.new(0.25, def.radius * 2 * k, def.radius * 2 * k)
			if left > 0 and left < 0.75 then
				local f = 1 - left / 0.75
				local y = (Cfg.LEASH_UP + 10) * (1 - f * f) -- падает со «потолка» арены: бьёт весь столб
				local cf = CFrame.new(spot + Vector3.new(0, def.radius * 0.35 + y, 0)) * spin * CFrame.Angles(t * 3, t * 2, 0)
				rock.CFrame = cf
				rock2.CFrame = cf * CFrame.new(1, 1.2, -0.6) * CFrame.Angles(0.6, 0.3, 0)
				glow.CFrame = cf * CFrame.new(0, 0, -def.radius * 0.43)
				rock.Transparency, rock2.Transparency, glow.Transparency = 0, 0, 0.2
			elseif left <= 0 and not landed then
				landed = true
				local cf = CFrame.new(spot + Vector3.new(0, def.radius * 0.3, 0)) * spin
				rock.CFrame = cf
				rock2.CFrame = cf * CFrame.new(1, 1.2, -0.6) * CFrame.Angles(0.6, 0.3, 0)
				glow.CFrame = cf * CFrame.new(0, 0, -def.radius * 0.43)
				shadow.Transparency = 1
				for _, d in ipairs(holder:GetChildren()) do
					if d.Name == "Edge" then
						d:Destroy()
					end
				end
				FX.debris(spot + Vector3.new(0, 2, 0), 10, L.STONE, 40, 1.4)
				FX.burst(spot + Vector3.new(0, 2, 0), Color3.fromRGB(210, 200, 190), 22, 20, 6, false)
				FX.ring(spot, 1, def.radius * 1.6, 0.4, L.DANGER_SOFT, 1.4, 1)
				FX.shakeAt(spot, 2.4, 110, 0.45)
				snd(SND.RUBBLE, FB.rubble, spot, { range = 260 })
			elseif left < -def.linger then
				-- камень рассыпается
				conn:Disconnect()
				for _, p in ipairs({ rock, rock2, glow }) do
					TweenService:Create(p, TweenInfo.new(0.6), { Transparency = 1, Size = p.Size * 0.4 }):Play()
				end
				FX.debris(spot + Vector3.new(0, 2, 0), 6, L.STONE_DARK, 18, 1)
				Debris:AddItem(holder, 0.7)
			end
		end)
	end
end

local function beamCF(arena: Vector3, ang: number, def, len: number): CFrame
	return CFrame.new(arena + Vector3.new(0, def.height, 0)) * CFrame.Angles(0, ang, 0) * CFrame.new(0, 0, -len * 0.5 - 4)
end

local function updateAct(t: number)
	local act = view and view.act
	if not act then
		return
	end
	local def = act.def
	local e = t - act.t0
	local arena = attr("GArena") or Vector3.zero

	if act.name == "slam" then
		local k = math.clamp(e / def.windup, 0, 1)
		if act.fill and act.fill.Parent then
			act.fill.Size = Vector3.new(0.25, def.radius * 2 * k, def.radius * 2 * k)
			act.fill.Transparency = 0.72 - 0.3 * k + 0.08 * math.sin(t * 20)
		end
		if e >= def.windup and not act.done.hit then
			act.done.hit = true
			if act.fill then
				act.fill:Destroy()
				act.fill = nil
			end
			for _, o in ipairs(act.holder:GetChildren()) do
				o:Destroy()
			end
			impact(act.target, def.ring, 1)
			snd(SND.SLAM, FB.slam, act.target, { range = 400, min = 30 })
		end
	elseif act.name == "sweep" then
		local k = math.clamp(e / def.windup, 0, 1)
		for i, p in ipairs(act.fan or {}) do
			p.Transparency = 0.92 - 0.45 * k + 0.05 * math.sin(t * 25 + i)
		end
		if e >= def.windup and not act.done.hit then
			act.done.hit = true
			for _, p in ipairs(act.fan) do
				p:Destroy()
			end
			act.fan = {}
			-- след взмаха по дуге
			local half = math.rad(def.arc * 0.5)
			for i = 0, 12 do
				task.delay(i * 0.012, function()
					local a = act.dir + half - i / 12 * half * 2
					local blade = flatPart({
						Name = "Swoosh",
						Size = Vector3.new(0.6, 3.5, def.radius * 0.6),
						CFrame = CFrame.new(arena + Vector3.new(0, 6, 0)) * CFrame.Angles(0, a, 0) * CFrame.new(0, 0, -def.radius * 0.62),
						Color = L.DANGER_SOFT,
						Material = Enum.Material.Neon,
						Transparency = 0.15,
						Parent = folder,
					})
					TweenService:Create(blade, TweenInfo.new(0.35), { Transparency = 1, Size = blade.Size * Vector3.new(0.2, 0.4, 1.2) }):Play()
					Debris:AddItem(blade, 0.4)
				end)
			end
			FX.burst(arena + Vector3.new(0, 3, 0), Color3.fromRGB(220, 210, 200), 26, 40, 5, false)
			FX.shakeAt(arena, 2.6, 120, 0.4)
			snd(SND.SWEEP, FB.sweep, arena, { range = 300 })
		end
	elseif act.name == "quake" then
		local k = math.clamp(e / def.windup, 0, 1)
		for _, l in ipairs(act.lines or {}) do
			local len = def.maxR * 0.35 * k
			l.p.Size = Vector3.new(0.6, 0.25, math.max(len, 0.5))
			l.p.CFrame = CFrame.new(arena + Vector3.new(math.cos(l.a) * len * 0.5, 0.25, math.sin(l.a) * len * 0.5)) * CFrame.Angles(0, -l.a + math.pi / 2, 0)
			l.p.Transparency = 0.5 - 0.3 * k
		end
		if act.center then
			act.center.Size = Vector3.new(0.25, 12 + 8 * k, 12 + 8 * k)
			act.center.Transparency = 0.5 - 0.25 * math.abs(math.sin(t * 12))
		end
		if e > def.windup * 0.4 then
			FX.shakeAt(arena, 0.25, 120, 0.1)
		end
		if e >= def.windup and not act.done.hit then
			act.done.hit = true
			for _, o in ipairs(act.holder:GetChildren()) do
				o:Destroy()
			end
			quakeWave(arena, act.t0 + def.windup, def, act.holder)
			impact(arena, 26, 1.2)
			snd(SND.QUAKE, FB.quake, arena, { range = 500, min = 40 })
		end
	elseif act.name == "beams" then
		local tS = act.t0 + def.windup
		local n = act.count
		if e < def.windup then
			local k = e / def.windup
			for i, line in ipairs(act.lines) do
				local ang = act.dir + (i - 1) * (2 * math.pi / n)
				line.CFrame = beamCF(arena, ang, def, def.length)
				line.Transparency = 0.85 - 0.45 * k + 0.1 * math.sin(t * 30 + i)
			end
			if act.orb then
				local s = 1 + 7 * k
				act.orb.Size = Vector3.new(s, s, s)
				act.orb.CFrame = CFrame.new(arena + Vector3.new(0, 30, 0))
			end
		elseif e < def.windup + def.duration then
			if not act.done.on then
				act.done.on = true
				for _, line in ipairs(act.lines) do
					line:Destroy()
				end
				act.lines = {}
				-- столб света из нимба в пол
				act.pillar = flatPart({
					Name = "Pillar",
					Shape = Enum.PartType.Cylinder,
					Size = Vector3.new(30, 5, 5),
					CFrame = CFrame.new(arena + Vector3.new(0, 15, 0)) * CFrame.Angles(0, 0, math.rad(90)),
					Color = L.BEAM,
					Material = Enum.Material.Neon,
					Transparency = 0.25,
					Parent = act.holder,
				})
				for i = 1, n do
					local core = flatPart({ Name = "Beam", Size = Vector3.new(def.thick, def.thick, def.length), Color = Color3.new(1, 1, 1), Material = Enum.Material.Neon, Parent = act.holder })
					local glow = flatPart({ Name = "BeamGlow", Size = Vector3.new(def.thick * 2.4, def.thick * 2.4, def.length), Color = L.BEAM, Material = Enum.Material.Neon, Transparency = 0.65, Parent = act.holder })
					local tip = Instance.new("Attachment")
					tip.Parent = core
					tip.Position = Vector3.new(0, 0, -def.length * 0.5)
					local sp = Instance.new("ParticleEmitter")
					sp.Texture = "rbxasset://textures/particles/sparkles_main.dds"
					sp.Color = ColorSequence.new(L.BEAM)
					sp.LightEmission = 1
					sp.Size = NumberSequence.new(1.2, 0)
					sp.Speed = NumberRange.new(8, 18)
					sp.Lifetime = NumberRange.new(0.3, 0.6)
					sp.SpreadAngle = Vector2.new(70, 70)
					sp.Rate = 30
					sp.Parent = tip
					act.beams[i] = { core = core, glow = glow }
				end
				if act.orb then
					act.orb:Destroy()
					act.orb = nil
				end
				if SND.BEAM_LOOP and SND.BEAM_LOOP ~= 0 then
					act.loop = FX.sound(SND.BEAM_LOOP, view.rig.core, { looped = true, volume = 0.9, range = 300 })
				else
					act.loop = FX.sound(OK.HUM_LOOP, view.rig.core, { looped = true, volume = 0.9, speed = 1.6, range = 300 })
				end
				if act.loop then
					act.loop:Play()
				end
				FX.ring(arena, 4, 40, 0.5, L.BEAM, 1.6, 1.5)
			end
			local turn = math.rad(def.turn) * act.sign
			local parts, cfs = {}, {}
			for i, b in ipairs(act.beams) do
				local ang = act.dir + (i - 1) * (2 * math.pi / n) + turn * (t - tS)
				local cf = beamCF(arena, ang, def, def.length)
				table.insert(parts, b.core)
				table.insert(cfs, cf)
				table.insert(parts, b.glow)
				table.insert(cfs, cf)
				b.glow.Transparency = 0.6 + 0.12 * math.sin(t * 40 + i)
			end
			workspace:BulkMoveTo(parts, cfs, Enum.BulkMoveMode.FireCFrameChanged)
		elseif not act.done.off then
			act.done.off = true
			for _, b in ipairs(act.beams) do
				TweenService:Create(b.core, TweenInfo.new(0.3), { Transparency = 1, Size = b.core.Size * Vector3.new(0.1, 0.1, 1) }):Play()
				TweenService:Create(b.glow, TweenInfo.new(0.3), { Transparency = 1 }):Play()
			end
			if act.pillar then
				TweenService:Create(act.pillar, TweenInfo.new(0.4), { Transparency = 1 }):Play()
			end
			if act.loop then
				act.loop:Destroy()
				act.loop = nil
			end
		end
	end
end

-- ===== полоса здоровья =====

local hud = nil
local function buildHud()
	local gui = Instance.new("ScreenGui")
	gui.Name = "ArchGuardianHUD"
	gui.ResetOnSpawn = false
	gui.IgnoreGuiInset = false
	gui.DisplayOrder = 5
	gui.Enabled = false
	gui.Parent = player:WaitForChild("PlayerGui")

	local box = Instance.new("Frame")
	box.Name = "Box"
	box.AnchorPoint = Vector2.new(0.5, 0)
	box.Position = UDim2.new(0.5, 0, 0, 14)
	box.Size = UDim2.new(0.62, 0, 0, 58)
	box.BackgroundTransparency = 1
	box.Parent = gui
	local lim = Instance.new("UISizeConstraint")
	lim.MaxSize = Vector2.new(560, 58)
	lim.Parent = box

	local title = Instance.new("TextLabel")
	title.Name = "Title"
	title.BackgroundTransparency = 1
	title.Size = UDim2.new(1, 0, 0, 22)
	title.Font = Enum.Font.GothamBlack
	title.TextScaled = true
	title.TextColor3 = Color3.fromRGB(240, 250, 255)
	title.Text = string.upper(T.name)
	title.Parent = box
	local ts = Instance.new("UIStroke")
	ts.Thickness = 1.5
	ts.Color = Color3.fromRGB(20, 40, 50)
	ts.Parent = title

	local bar = Instance.new("Frame")
	bar.Name = "Bar"
	bar.Position = UDim2.new(0, 0, 0, 26)
	bar.Size = UDim2.new(1, 0, 0, 16)
	bar.BackgroundColor3 = Color3.fromRGB(20, 22, 34)
	bar.BackgroundTransparency = 0.2
	bar.BorderSizePixel = 0
	bar.Parent = box
	local bc = Instance.new("UICorner")
	bc.CornerRadius = UDim.new(0.5, 0)
	bc.Parent = bar
	local bs = Instance.new("UIStroke")
	bs.Thickness = 1.5
	bs.Color = L.GLOW
	bs.Transparency = 0.4
	bs.Parent = bar

	local chip = Instance.new("Frame")
	chip.Name = "Chip"
	chip.Size = UDim2.fromScale(1, 1)
	chip.BackgroundColor3 = Color3.new(1, 1, 1)
	chip.BackgroundTransparency = 0.35
	chip.BorderSizePixel = 0
	chip.Parent = bar
	local cc = Instance.new("UICorner")
	cc.CornerRadius = UDim.new(0.5, 0)
	cc.Parent = chip

	local fill = Instance.new("Frame")
	fill.Name = "Fill"
	fill.Size = UDim2.fromScale(1, 1)
	fill.BackgroundColor3 = Color3.new(1, 1, 1)
	fill.BorderSizePixel = 0
	fill.Parent = bar
	local fc = Instance.new("UICorner")
	fc.CornerRadius = UDim.new(0.5, 0)
	fc.Parent = fill
	local grad = Instance.new("UIGradient")
	grad.Color = ColorSequence.new(L.GLOW, Color3.fromRGB(230, 255, 250))
	grad.Parent = fill

	for _, th in ipairs({ Cfg.PHASES[2], Cfg.PHASES[3] }) do
		if th then
			local mark = Instance.new("Frame")
			mark.Name = "Mark"
			mark.AnchorPoint = Vector2.new(0.5, 0.5)
			mark.Position = UDim2.fromScale(th, 0.5)
			mark.Size = UDim2.new(0, 3, 1.5, 0)
			mark.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
			mark.BorderSizePixel = 0
			mark.ZIndex = 3
			mark.Parent = bar
		end
	end

	local phase = Instance.new("TextLabel")
	phase.Name = "Phase"
	phase.BackgroundTransparency = 1
	phase.Position = UDim2.new(0, 0, 0, 44)
	phase.Size = UDim2.new(1, 0, 0, 14)
	phase.Font = Enum.Font.GothamBold
	phase.TextScaled = true
	phase.TextColor3 = Color3.fromRGB(200, 240, 235)
	phase.Text = ""
	phase.Parent = box

	hud = { gui = gui, fill = fill, chip = chip, grad = grad, stroke = bs, phase = phase, shown = 1, chipV = 1 }
end

local function updateHud(dt: number, visible: boolean)
	if not hud then
		buildHud()
	end
	hud.gui.Enabled = visible
	if not visible or not view then
		return
	end
	local hum = view.server:FindFirstChildOfClass("Humanoid")
	local frac = 1
	if hum and hum.MaxHealth > 0 then
		frac = math.clamp(hum.Health / hum.MaxHealth, 0, 1)
	end
	hud.shown += (frac - hud.shown) * math.clamp(dt * 12, 0, 1)
	-- «хвост» урона догоняет с задержкой
	if hud.chipV > hud.shown then
		hud.chipV = math.max(hud.shown, hud.chipV - dt * 0.35)
	else
		hud.chipV = hud.shown
	end
	hud.fill.Size = UDim2.fromScale(hud.shown, 1)
	hud.chip.Size = UDim2.fromScale(hud.chipV, 1)
	local ph = attr("GPhase") or 1
	local c = glowColor(ph)
	hud.grad.Color = ColorSequence.new(c, c:Lerp(Color3.new(1, 1, 1), 0.7))
	hud.stroke.Color = c
	-- неуязвим — переливается
	if attr("GInvuln") then
		hud.fill.BackgroundTransparency = 0.25 + 0.25 * math.sin(os.clock() * 8)
	else
		hud.fill.BackgroundTransparency = 0
	end
	hud.phase.Text = string.format(T.phase, ph, T.phases[ph] or "")
end

-- ===== знакомство: сцена (если Страж просыпается) или титр =====

local metShown = false

local function banner(lines, color: Color3, dur: number, big: boolean?)
	local gui = Instance.new("ScreenGui")
	gui.Name = "ArchGuardianBanner"
	gui.ResetOnSpawn = false
	gui.DisplayOrder = 20
	gui.Parent = player:WaitForChild("PlayerGui")
	local box = Instance.new("Frame")
	box.AnchorPoint = Vector2.new(0.5, 0.5)
	box.Position = UDim2.fromScale(0.5, big and 0.32 or 0.4)
	box.Size = UDim2.fromScale(0.8, big and 0.22 or 0.16)
	box.BackgroundTransparency = 1
	box.Parent = gui
	local layout = Instance.new("UIListLayout")
	layout.HorizontalAlignment = Enum.HorizontalAlignment.Center
	layout.VerticalAlignment = Enum.VerticalAlignment.Center
	layout.Padding = UDim.new(0, 4)
	layout.Parent = box
	local labels = {}
	for i, text in ipairs(lines) do
		local l = Instance.new("TextLabel")
		l.BackgroundTransparency = 1
		l.Size = UDim2.new(1, 0, i == 1 and 0.5 or 0.2, 0)
		l.Font = (i == 1) and Enum.Font.GothamBlack or Enum.Font.GothamBold
		l.TextScaled = true
		l.Text = text
		l.TextColor3 = (i == 1) and color or Color3.fromRGB(235, 240, 255)
		l.TextTransparency = 1
		l.Parent = box
		local st = Instance.new("UIStroke")
		st.Thickness = (i == 1) and 3 or 1.5
		st.Color = Color3.fromRGB(16, 20, 30)
		st.Transparency = 1
		st.Parent = l
		local tc = Instance.new("UITextSizeConstraint")
		tc.MaxTextSize = (i == 1) and 64 or 28
		tc.Parent = l
		labels[i] = { l = l, s = st }
	end
	-- появление: по строке, с пружинкой масштаба
	local scale = Instance.new("UIScale")
	scale.Scale = 0.6
	scale.Parent = box
	TweenService:Create(scale, TweenInfo.new(0.55, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Scale = 1 }):Play()
	for i, x in ipairs(labels) do
		task.delay(0.12 * (i - 1), function()
			TweenService:Create(x.l, TweenInfo.new(0.35), { TextTransparency = 0 }):Play()
			TweenService:Create(x.s, TweenInfo.new(0.35), { Transparency = 0 }):Play()
		end)
	end
	task.delay(dur, function()
		for _, x in ipairs(labels) do
			TweenService:Create(x.l, TweenInfo.new(0.6), { TextTransparency = 1 }):Play()
			TweenService:Create(x.s, TweenInfo.new(0.6), { Transparency = 1 }):Play()
		end
		task.delay(0.7, function()
			gui:Destroy()
		end)
	end)
	return gui
end

local function playCutscene(dur: number)
	local cam = workspace.CurrentCamera
	local char = player.Character
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	if not cam or not hum or char:GetAttribute("FlightState") ~= nil then
		banner({ T.name, T.sub }, L.GLOW, 3.2, true)
		return
	end
	local base = floorCF()
	local look = base.Position + Vector3.new(0, 16, 0)
	local p0 = (base * CFrame.new(-30, 7, -40)).Position
	local p1 = (base * CFrame.new(20, 20, -48)).Position
	local prevType = cam.CameraType
	cam.CameraType = Enum.CameraType.Scriptable

	-- полосы кино сверху и снизу
	local gui = Instance.new("ScreenGui")
	gui.Name = "ArchCutscene"
	gui.ResetOnSpawn = false
	gui.IgnoreGuiInset = true
	gui.DisplayOrder = 30
	gui.Parent = player:WaitForChild("PlayerGui")
	local bars = {}
	for i, y in ipairs({ 0, 1 }) do
		local b = Instance.new("Frame")
		b.AnchorPoint = Vector2.new(0, y)
		b.Position = UDim2.fromScale(0, y)
		b.Size = UDim2.fromScale(1, 0)
		b.BackgroundColor3 = Color3.new(0, 0, 0)
		b.BorderSizePixel = 0
		b.Parent = gui
		bars[i] = b
		TweenService:Create(b, TweenInfo.new(0.5, Enum.EasingStyle.Quad), { Size = UDim2.fromScale(1, 0.11) }):Play()
	end
	local hint = Instance.new("TextLabel")
	hint.BackgroundTransparency = 1
	hint.AnchorPoint = Vector2.new(1, 1)
	hint.Position = UDim2.new(1, -16, 1, -8)
	hint.Size = UDim2.new(0.4, 0, 0.05, 0)
	hint.Font = Enum.Font.GothamBold
	hint.TextScaled = true
	hint.TextXAlignment = Enum.TextXAlignment.Right
	hint.TextColor3 = Color3.fromRGB(200, 210, 230)
	hint.TextTransparency = 0.3
	hint.Text = T.skip
	hint.ZIndex = 2
	hint.Parent = gui

	local t0 = os.clock()
	local DUR = dur
	local done = false
	local function finish()
		if done then
			return
		end
		done = true
		RunService:UnbindFromRenderStep("ArchGuardianCut")
		cam.CameraType = (prevType == Enum.CameraType.Scriptable) and Enum.CameraType.Custom or prevType
		cam.CameraSubject = hum
		for _, b in ipairs(bars) do
			TweenService:Create(b, TweenInfo.new(0.4), { Size = UDim2.fromScale(1, 0) }):Play()
		end
		task.delay(0.45, function()
			gui:Destroy()
		end)
	end
	task.delay(1.4, function()
		if not done then
			banner({ T.name, T.sub }, L.GLOW, 2.6, true)
		end
	end)
	local skipConn
	skipConn = UserInputService.InputBegan:Connect(function(input)
		if os.clock() - t0 > 0.6 and (input.UserInputType == Enum.UserInputType.Touch
			or input.UserInputType == Enum.UserInputType.MouseButton1
			or input.UserInputType == Enum.UserInputType.Keyboard
			or input.UserInputType == Enum.UserInputType.Gamepad1) then
			skipConn:Disconnect()
			finish()
		end
	end)
	RunService:BindToRenderStep("ArchGuardianCut", Enum.RenderPriority.Camera.Value + 1, function()
		local k = (os.clock() - t0) / DUR
		-- пробуждение кончилось (или Страж пропал) — камеру сразу вернуть
		if k >= 1 or not view or attr("GState") ~= "intro" then
			skipConn:Disconnect()
			finish()
			return
		end
		local e = k * k * (3 - 2 * k)
		local pos = p0:Lerp(p1, e)
		cam.CFrame = CFrame.lookAt(pos, look + Vector3.new(0, 6 * e, 0))
	end)
end

local function checkMeet()
	if metShown or not view then
		return
	end
	if player:GetAttribute("ArchGuardianMet") == true then
		metShown = true
		return
	end
	local st = attr("GState")
	if st ~= "intro" and st ~= "fight" and st ~= "transition" then
		return
	end
	local hrp = FX.rootPart()
	local arena = attr("GArena")
	if not hrp or not arena then
		return
	end
	if Vector3.new(hrp.Position.X - arena.X, 0, hrp.Position.Z - arena.Z).Magnitude > Cfg.WAKE_RADIUS * 1.25 then
		return
	end
	metShown = true
	local left = (attr("GIntroT0") or 0) + Cfg.INTRO - workspace:GetServerTimeNow()
	if st == "intro" and left >= 1.5 then
		playCutscene(math.min(4.4, left))
	else
		banner({ T.name, T.sub }, L.GLOW, 3, true)
	end
end

-- ===== разрушение при победе =====

local function crumble()
	if not view or view.crumbling then
		return
	end
	view.crumbling = true
	endAct()
	local rig = view.rig
	local center = (attr("GArena") or Vector3.zero) + Vector3.new(0, 14, 0)
	-- столб света и вспышка
	local pillar = FX.part({
		Name = "VictoryPillar",
		Shape = Enum.PartType.Cylinder,
		Size = Vector3.new(260, 10, 10),
		CFrame = CFrame.new(center + Vector3.new(0, 120, 0)) * CFrame.Angles(0, 0, math.rad(90)),
		Color = L.GLOW:Lerp(Color3.new(1, 1, 1), 0.5),
		Material = Enum.Material.Neon,
		Transparency = 0.1,
		Parent = folder,
	})
	TweenService:Create(pillar, TweenInfo.new(3.2, Enum.EasingStyle.Quad), { Transparency = 1, Size = Vector3.new(260, 2, 2) }):Play()
	Debris:AddItem(pillar, 3.5)
	FX.flash(Color3.fromRGB(230, 255, 250), 1, 1.2)
	FX.shakeAt(center, 5, 260, 1.2)
	FX.ring(center - Vector3.new(0, 13, 0), 4, 70, 1, L.GLOW, 2.4, 2)
	snd(SND.CRUMBLE, FB.crumble, center, { range = 700, min = 60 })
	-- камни рассыпаются (локальная физика)
	for _, p in ipairs(rig.parts) do
		if p.Parent then
			p.Anchored = false
			p.CanCollide = false -- тяжёлые обломки не должны сбрасывать игроков с арены
			local out = (p.Position - center)
			out = (out.Magnitude > 0.1) and out.Unit or Vector3.yAxis
			p.AssemblyLinearVelocity = out * math.random(12, 30) + Vector3.new(0, math.random(10, 26), 0)
			p.AssemblyAngularVelocity = Vector3.new(math.random(-6, 6), math.random(-6, 6), math.random(-6, 6))
		end
	end
	-- нимб — осколками вверх
	for _, h in ipairs(rig.halo) do
		h.part.CanCollide = false
		h.part.AssemblyLinearVelocity = Vector3.new(math.random(-14, 14), math.random(30, 55), math.random(-14, 14))
	end
	snd(SND.HALO_CRACK, FB.crack, center + Vector3.new(0, 14, 0), { range = 400 })
	task.delay(4, function()
		for _, p in ipairs(rig.parts) do
			if p.Parent then
				TweenService:Create(p, TweenInfo.new(1.5), { Transparency = 1 }):Play()
			end
		end
		task.delay(1.6, function()
			rig.model:Destroy()
		end)
	end)
end

-- ===== сообщения сервера =====

if remote then
	remote.OnClientEvent:Connect(function(kind, a, b)
		if kind == "knock" and typeof(a) == "Vector3" then
			FX.knock(a)
		elseif kind == "hit" then
			FX.flash(L.DANGER, 0.7, 0.4)
			FX.shake(2, 0.35)
		elseif kind == "rubble" and type(a) == "table" and type(b) == "number" then
			-- далеко от арены не строим (камнепад видят только рядом)
			if FX.inWorld() and typeof(a[1]) == "Vector3" and (a[1] - FX.camPos()).Magnitude < 450 then
				rubbleSpots(a, b)
			end
		elseif kind == "reward" and type(a) == "table" then
			local lines = { T.win }
			for _, k in ipairs(a) do
				if T[k] then
					table.insert(lines, T[k])
				end
			end
			if #a == 0 then
				table.insert(lines, T.again)
			end
			table.insert(lines, T.back)
			task.delay(1.2, function()
				banner(lines, Color3.fromRGB(255, 226, 150), 5, true)
				FX.layers({ { id = OK.CHOIR, volume = 1 }, { id = OK.CHIME[1], speed = 1.1, volume = 0.8 } }, nil)
			end)
		end
	end)
end

-- ===== главный цикл =====

local lastN = -1
local lastState = ""

RunService.RenderStepped:Connect(function(dt)
	dt = math.min(dt, 0.1)
	local m = serverModel()
	local inWorld = FX.inWorld()

	if not m or not inWorld then
		if view and not view.crumbling then
			destroyView()
		end
		updateHud(dt, false)
		return
	end
	if view and view.crumbling then
		-- рассыпался; ждём возрождения (тот же экземпляр модели вернётся в состоянии dormant)
		if (m:GetAttribute("GState") or "") == "dead" then
			updateHud(dt, false)
			return
		end
		view = nil
	end
	if not view or view.server ~= m then
		buildView(m)
		lastN = -1 -- показать атаку, которая уже идёт (если её замах ещё не кончился)
		lastState = ""
	end

	local t = workspace:GetServerTimeNow()
	local st = attr("GState") or "dormant"
	local cam = FX.camPos()
	local arena = attr("GArena") or Vector3.zero
	local dist = (arena - cam).Magnitude

	-- смена состояния
	if st ~= lastState then
		local prev = lastState
		lastState = st
		if st == "dead" then
			-- пришли поздно (давно повержен) — просто не показываем
			if workspace:GetServerTimeNow() - (attr("GDeathT") or 0) < 3 then
				crumble()
			else
				view.rig.model:Destroy()
				view.crumbling = true
			end
			return
		elseif st == "intro" and prev ~= "" then
			snd(SND.WAKE, FB.wake, view.rig.core, { range = 500 })
		elseif st == "transition" then
			snd(SND.HALO_CRACK, FB.crack, view.rig.core, { range = 500 })
			task.delay(0.35, function()
				if view and view.rig then
					snd(SND.ROAR, FB.roar, view.rig.core, { range = 600 })
					FX.ring(arena, 4, 44, 0.8, glowColor((attr("GPhase") or 1) + 1), 2.2, 2)
					FX.shakeAt(arena, 3.2, 200, 0.9)
					FX.flash(L.ANGRY, 0.5, 0.6)
				end
			end)
		end
	end
	if st == "dead" then
		return
	end

	-- поворот вида к серверному
	local root = m:FindFirstChild("HumanoidRootPart") :: BasePart?
	if root then
		local _, y = root.CFrame:ToEulerAnglesYXZ()
		local diff = (y - view.yaw + math.pi) % (2 * math.pi) - math.pi
		view.yaw += diff * math.clamp(dt * 8, 0, 1)
	end

	-- фаза: цвет и трещина
	local ph = attr("GPhase") or 1
	if ph ~= view.phase then
		view.phase = ph
		recolor(ph)
	end

	-- новое действие
	local n = attr("GActN") or 0
	if n ~= lastN then
		lastN = n
		local def = A[attr("GAct") or ""]
		if def and t < (attr("GActT0") or t) + def.windup + (def.duration or 0) then
			startAct(n)
		end
	end
	if (attr("GAct") or "") == "" and view.act then
		endAct()
	end
	if attr("GFrozen") == true and view.act then
		endAct()
	end
	updateAct(t)

	-- поза и пружины
	local pose, tremble = poseFor(t)
	local sp = view.springs
	local f, z = pose.f or 2, pose.z or 0.45
	local breathe = math.sin(t * 1.25) * math.rad(1.6)
	-- голова смотрит на игрока рядом
	local lookYaw = 0
	local hrp = FX.rootPart()
	if hrp and st ~= "dormant" then
		local v = hrp.Position - arena
		local want = math.atan2(-v.X, -v.Z)
		local d = (want - view.yaw + math.pi) % (2 * math.pi) - math.pi
		lookYaw = math.clamp(d, -0.45, 0.45)
	end
	local ang = {}
	for _, b in ipairs(GB.BONES) do
		local name = b[1]
		local tgt = pose[name] or { 0, 0, 0 }
		local s = sp[name]
		local tx, ty, tz = math.rad(tgt[1]), math.rad(tgt[2]), math.rad(tgt[3])
		if name == "waist" then
			tx += breathe
		elseif name == "neck" then
			ty += lookYaw
		elseif name == "shR" then
			tz += breathe
		elseif name == "shL" then
			tz -= breathe
		end
		if tremble > 0 and (name == "waist" or name == "neck") then
			tx += math.noise((os.clock() - T_BASE) * 22, 1) * 0.05 * tremble
			tz += math.noise((os.clock() - T_BASE) * 22, 2) * 0.05 * tremble
		end
		ang[name] = {
			WorldMath.spring(s[1], tx, f, z, dt),
			WorldMath.spring(s[2], ty, f, z, dt),
			WorldMath.spring(s[3], tz, f, z, dt),
		}
	end
	local rootY = WorldMath.spring(sp.rootY, pose.rootY or 0, f, z, dt)
	local haloUp = WorldMath.spring(sp.haloUp, pose.haloUp or 0, 2, 0.4, dt)

	-- нимб: крутится (быстро — в лучах и переходе), осколки парят, в «Гневе» мерцает
	local spin = 0.7
	if st == "dormant" then
		spin = 0.15
	elseif st == "transition" then
		spin = 6
	elseif (attr("GAct") or "") == "beams" then
		spin = 4.5
	end
	view.haloSpin += spin * dt
	local extra = {}
	for _, s in ipairs(view.rig.shards) do
		extra[s.part] = CFrame.new(0, math.sin(t * 2 + s.k) * 0.45, 0) * CFrame.Angles(t * s.k, t * 1.3, 0)
	end
	local dim = (st == "dormant") and 0.75 or 0
	if st == "intro" then
		local e = t - (attr("GIntroT0") or t)
		dim = math.clamp(1 - e / 2, 0, 1) * 0.75
	end
	for _, h in ipairs(view.rig.halo) do
		if h.part.Transparency < 1 then
			local fl = (ph >= 3) and (0.25 * (0.5 + 0.5 * math.sin(t * 17 + h.index))) or 0
			h.part.Transparency = math.clamp(dim + fl, 0, 0.95)
		end
	end
	view.rig.visor.Transparency = dim * 0.9
	view.rig.core.Transparency = dim * 0.8
	for _, l in ipairs(view.rig.lights) do
		l.Brightness = 2 * (1 - dim) * (attr("GInvuln") and st ~= "dormant" and (1 + 0.4 * math.sin(t * 9)) or 1)
	end

	-- далеко — реже (поза каждый 3-й кадр)
	view.frame = (view.frame or 0) + 1
	if dist < 450 or view.frame % 3 == 0 then
		GB.pose(view.rig, floorCF(), ang, rootY, haloUp, view.haloSpin, extra)
	end

	-- знакомство, полоса здоровья
	checkMeet()
	local showHud = (st == "intro" or st == "fight" or st == "transition") and dist < Cfg.LEASH * 1.4
	updateHud(dt, showHud)
end)

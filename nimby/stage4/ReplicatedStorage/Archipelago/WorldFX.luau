--!nonstrict
-- WorldFX — общие эффекты «Живого мира» (этап 4). ТОЛЬКО КЛИЕНТ.
-- Доступ к миру, тряска (поворотом камеры, FOV/CameraOffset не трогаем), вспышка через LightingDirector
-- (слой "fx"), звуки в SoundService.World, кольца-волны, обломки, толчок своего персонажа.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local SoundService = game:GetService("SoundService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Debris = game:GetService("Debris")
local UserGameSettings = UserSettings():GetService("UserGameSettings")

local Arch = ReplicatedStorage:WaitForChild("Archipelago")

local FX = {}
local player = Players.LocalPlayer

-- в полёте толчок дополнительно передаём FlightClient атрибутами FlightKnock/FlightKnockT.
-- TODO(studio): сверить формат с FlightClient; если не понимает — поставить false.
FX.USE_FLIGHT_KNOCK = true

local Director
do
	local ok, d = pcall(function()
		return require(Arch:WaitForChild("LightingDirector"))
	end)
	if ok and type(d) == "table" then
		Director = d
	end
end
FX.Director = Director

local FlightShared
do
	local ok, m = pcall(function()
		return require(Arch:WaitForChild("FlightShared", 10))
	end)
	if ok and type(m) == "table" then
		FlightShared = m
	end
end

local Clock = require(Arch:WaitForChild("WorldClock"))
FX.Clock = Clock

-- ===== доступ =====

function FX.hasAccess(): boolean
	return player ~= nil and player:GetAttribute("WorldAccess") == true
end

local function busy(inst)
	return inst ~= nil
		and (inst:GetAttribute("InDuel") or inst:GetAttribute("NimbusInMatch") or inst:GetAttribute("NimbusInRoulette"))
end

local function computeInWorld(): boolean
	if not FX.hasAccess() then
		return false
	end
	if FlightShared and type(FlightShared.cloudReturn) == "function" then
		local ok, r = pcall(FlightShared.cloudReturn, player)
		if ok and type(r) == "boolean" then
			return r
		end
	end
	if player:GetAttribute("Zone") ~= "World" then
		return false
	end
	return not (busy(player) or busy(player.Character))
end

local inWorldCache, inWorldAt = false, -1
-- «в мире»: доступ + Zone == World + не в матче/дуэли/рулетке. Кэш 0.5 с.
function FX.inWorld(): boolean
	local t = os.clock()
	if t - inWorldAt > 0.5 then
		inWorldAt = t
		inWorldCache = computeInWorld()
	end
	return inWorldCache
end

-- свет директора сейчас не пишется (матч/дуэль/Royale)
function FX.lightSuspended(): boolean
	if Director and type(Director.suspended) == "function" then
		local ok, r = pcall(Director.suspended)
		return ok and r == true
	end
	return false
end

-- ===== папка для локальных моделей =====

function FX.localFolder(name: string): Folder
	local root = workspace:FindFirstChild("ArchLocal")
	if not root then
		root = Instance.new("Folder")
		root.Name = "ArchLocal"
		root.Parent = workspace
	end
	local f = root:FindFirstChild(name)
	if not f then
		f = Instance.new("Folder")
		f.Name = name
		f.Parent = root
	end
	return f
end

-- ===== уменьшить движение / качество =====

function FX.reducedMotion(): boolean
	local ok, r = pcall(function()
		return UserGameSettings.ReducedMotion
	end)
	return ok and r == true
end

-- 0..1: уровень графики игрока (1 = максимум)
function FX.quality(): number
	local ok, q = pcall(function()
		return UserGameSettings.SavedQualityLevel.Value
	end)
	if not ok or q == 0 then
		return 0.7 -- «автоматически»
	end
	return math.clamp(q / 10, 0.2, 1)
end

function FX.isTouch(): boolean
	local UIS = game:GetService("UserInputService")
	return UIS.TouchEnabled and not UIS.KeyboardEnabled
end

-- ===== тряска камеры =====
-- Поворот Camera.CFrame после камеры: FOV и CameraOffset не трогаем (их пишут способности).

local shakes = {}
local shakeBound = false
local T_BASE = os.clock() -- math.noise считает во float32: подаём маленькие числа
-- что тряска добавила к камере в этом кадре: до обновления камеры возвращаем как было,
-- иначе стандартная камера «запомнит» поворот и взгляд уплывёт
local applied = CFrame.identity
local written: CFrame? = nil

local function bindShake()
	if shakeBound then
		return
	end
	shakeBound = true
	RunService:BindToRenderStep("ArchWorldShakeUndo", Enum.RenderPriority.Camera.Value - 1, function()
		local cam = workspace.CurrentCamera
		if cam and written and cam.CFrame == written then
			cam.CFrame = cam.CFrame * applied:Inverse()
		end
		applied, written = CFrame.identity, nil
	end)
	RunService:BindToRenderStep("ArchWorldShake", Enum.RenderPriority.Camera.Value + 2, function()
		if #shakes == 0 then
			return
		end
		local now = os.clock()
		local rx, ry, rz = 0, 0, 0
		for i = #shakes, 1, -1 do
			local s = shakes[i]
			local k = (now - s.t0) / s.d
			if k >= 1 then
				table.remove(shakes, i)
			else
				local e = (1 - k) * (1 - k) * s.a
				local tn = now - T_BASE
				rx += math.noise(tn * s.f, 0.5, i) * e
				ry += math.noise(0.5, tn * s.f, i) * e
				rz += math.noise(tn * s.f, i, 0.5) * e * 0.5
			end
		end
		local cam = workspace.CurrentCamera
		if cam then
			applied = CFrame.Angles(math.rad(rx), math.rad(ry), math.rad(rz))
			cam.CFrame = cam.CFrame * applied
			written = cam.CFrame
		end
	end)
end

-- amp — градусы, dur — с, freq — Гц
function FX.shake(amp: number, dur: number, freq: number?)
	if FX.reducedMotion() then
		amp *= 0.25
	end
	if amp < 0.02 then
		return
	end
	bindShake()
	table.insert(shakes, { a = amp, d = math.max(dur, 0.05), f = freq or 16, t0 = os.clock() })
	if #shakes > 8 then
		table.remove(shakes, 1)
	end
end

-- тряска от удара в точке: сила падает с расстоянием
function FX.shakeAt(pos: Vector3, amp: number, radius: number, dur: number?)
	local cam = workspace.CurrentCamera
	if not cam then
		return
	end
	local d = (cam.CFrame.Position - pos).Magnitude
	if d >= radius then
		return
	end
	local k = 1 - d / radius
	FX.shake(amp * k * k, dur or 0.5)
end

-- ===== вспышка / тинт (LightingDirector, слой "fx") =====

local flashId = 0
function FX.flash(color: Color3, strength: number, dur: number)
	if not Director or FX.lightSuspended() then
		return
	end
	flashId += 1
	local my = flashId
	pcall(function()
		Director.set("fx", {
			["Grade.TintColor"] = color,
			["Grade.Brightness"] = 0.25 * strength,
			["Grade.Contrast"] = 0.1 * strength,
		})
		Director.weight("fx", math.clamp(strength, 0, 1), 0.04)
	end)
	task.delay(0.07, function()
		if my == flashId then
			pcall(Director.weight, "fx", 0, dur)
		end
	end)
end

-- ===== звук =====

local group = SoundService:FindFirstChild("World")
if not group then
	group = Instance.new("SoundGroup")
	group.Name = "World"
	group.Volume = 1
	group.Parent = SoundService
end
FX.SoundGroup = group

local function asset(id)
	if type(id) == "string" then
		return id
	end
	return "rbxassetid://" .. tostring(id)
end

-- id — число (0 = нет звука). where: Vector3 | BasePart | Attachment | nil (2D).
-- opts: volume, speed, range, min, life, looped
function FX.sound(id, where, opts)
	if id == nil or id == 0 or id == "" then
		return nil
	end
	opts = opts or {}
	local s = Instance.new("Sound")
	s.SoundId = asset(id)
	s.Volume = opts.volume or 0.6
	s.PlaybackSpeed = opts.speed or 1
	s.Looped = opts.looped == true
	s.SoundGroup = group
	s.RollOffMode = Enum.RollOffMode.InverseTapered
	s.RollOffMinDistance = opts.min or 12
	s.RollOffMaxDistance = opts.range or 450
	local holder
	if typeof(where) == "Vector3" then
		holder = Instance.new("Attachment")
		holder.Name = "ArchSnd"
		holder.WorldPosition = where
		holder.Parent = workspace.Terrain
		s.Parent = holder
	elseif typeof(where) == "Instance" then
		s.Parent = where
	else
		s.Parent = group
	end
	if not s.Looped then
		s:Play()
		local life = opts.life or 8
		Debris:AddItem(holder or s, life / math.max(s.PlaybackSpeed, 0.2))
	end
	return s
end

-- слои: {{id, speed, volume}, ...}
function FX.layers(list, where, opts)
	if type(list) ~= "table" then
		return
	end
	opts = opts or {}
	for _, l in ipairs(list) do
		FX.sound(l.id or l[1], where, {
			volume = (l.volume or 0.6) * (opts.volume or 1),
			speed = (l.speed or 1) * (opts.speed or 1),
			range = opts.range,
			min = opts.min,
			life = opts.life,
		})
	end
end

-- звук из конфига: id ≠ 0 — он, иначе временные слои
function FX.soundOr(id, fallback, where, opts)
	if id and id ~= 0 then
		return FX.sound(id, where, opts)
	end
	if type(fallback) == "table" then
		if fallback.id then
			FX.layers({ fallback }, where, opts)
		else
			FX.layers(fallback, where, opts)
		end
	end
	return nil
end

-- ===== кольцо-волна (из сегментов Neon, без мешей) =====

local RING_SEG = 28

-- pos — центр на полу; r0 → r1 за dur; color; thick — толщина; height
function FX.ring(pos: Vector3, r0: number, r1: number, dur: number, color: Color3, thick: number?, height: number?, parent: Instance?)
	local th: number = thick or 1.6
	local hh: number = height or 1.2
	local folder = parent or FX.localFolder("FX")
	local parts = {}
	for i = 1, RING_SEG do
		local p = Instance.new("Part")
		p.Anchored = true
		p.CanCollide = false
		p.CanQuery = false
		p.CanTouch = false
		p.CastShadow = false
		p.Material = Enum.Material.Neon
		p.Color = color
		p.Size = Vector3.new(th, hh, 1)
		p.Parent = folder
		parts[i] = p
	end
	local t0 = os.clock()
	local conn
	conn = RunService.RenderStepped:Connect(function()
		local k = (os.clock() - t0) / dur
		if k >= 1 then
			conn:Disconnect()
			for _, p in ipairs(parts) do
				p:Destroy()
			end
			return
		end
		local e = 1 - (1 - k) ^ 3 -- быстро в начале, мягко в конце
		local r = r0 + (r1 - r0) * e
		local chord = 2 * r * math.sin(math.pi / RING_SEG) * 1.08
		local cfs = table.create(RING_SEG)
		for i = 1, RING_SEG do
			local a = (i - 0.5) / RING_SEG * math.pi * 2
			cfs[i] = CFrame.new(pos + Vector3.new(math.cos(a) * r, hh * 0.5, math.sin(a) * r))
				* CFrame.Angles(0, -a, 0)
		end
		for i, p in ipairs(parts) do
			p.Size = Vector3.new(th * (1 - k * 0.6), hh * (1 - k * 0.5), chord)
			p.Transparency = k ^ 1.6
		end
		workspace:BulkMoveTo(parts, cfs, Enum.BulkMoveMode.FireCFrameChanged)
	end)
end

-- ===== обломки / пыль =====

function FX.debris(pos: Vector3, count: number, color: Color3, power: number?, size: number?)
	local folder = FX.localFolder("FX")
	local pw: number = power or 40
	local sz: number = size or 1.2
	count = math.max(1, math.floor(count * (0.5 + 0.5 * FX.quality())))
	for _ = 1, count do
		local p = Instance.new("Part")
		p.Size = Vector3.new(1, 1, 1) * sz * (0.5 + math.random())
		p.Color = color
		p.Material = Enum.Material.Slate
		p.CanCollide = false
		p.CanQuery = false
		p.CanTouch = false
		p.CastShadow = false
		p.CFrame = CFrame.new(pos + Vector3.new(math.random() * 4 - 2, 1, math.random() * 4 - 2))
			* CFrame.Angles(math.random() * 6, math.random() * 6, math.random() * 6)
		p.Parent = folder
		local dir = Vector3.new(math.random() - 0.5, 0.6 + math.random() * 0.8, math.random() - 0.5).Unit
		p.AssemblyLinearVelocity = dir * pw * (0.6 + math.random() * 0.6)
		p.AssemblyAngularVelocity = Vector3.new(math.random() * 20 - 10, math.random() * 20 - 10, math.random() * 20 - 10)
		Debris:AddItem(p, 1.6 + math.random())
	end
end

-- облако пыли / искр одним выбросом частиц
function FX.burst(pos: Vector3, color: Color3, count: number, speed: number?, size: number?, light: boolean?)
	local folder = FX.localFolder("FX")
	local a = Instance.new("Attachment")
	a.WorldPosition = pos
	a.Parent = workspace.Terrain
	local e = Instance.new("ParticleEmitter")
	e.Texture = light and "rbxasset://textures/particles/sparkles_main.dds" or "rbxasset://textures/particles/smoke_main.dds"
	e.Color = ColorSequence.new(color)
	e.LightEmission = light and 1 or 0.2
	e.Size = NumberSequence.new({
		NumberSequenceKeypoint.new(0, (size or 3) * 0.6),
		NumberSequenceKeypoint.new(1, (size or 3) * 1.6),
	})
	e.Transparency = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 0.25),
		NumberSequenceKeypoint.new(1, 1),
	})
	e.Lifetime = NumberRange.new(0.6, 1.3)
	e.Speed = NumberRange.new((speed or 20) * 0.5, speed or 20)
	e.SpreadAngle = Vector2.new(180, 180)
	e.Drag = 3
	e.Rate = 0
	e.Parent = a
	e:Emit(math.max(1, math.floor(count * (0.4 + 0.6 * FX.quality()))))
	Debris:AddItem(a, 2)
	return folder
end

-- короткий свет в точке
function FX.light(pos: Vector3, color: Color3, range: number, brightness: number, dur: number)
	local a = Instance.new("Attachment")
	a.WorldPosition = pos
	a.Parent = workspace.Terrain
	local l = Instance.new("PointLight")
	l.Color = color
	l.Range = math.min(range, 60)
	l.Brightness = brightness
	l.Shadows = false
	l.Parent = a
	local t0 = os.clock()
	local conn
	conn = RunService.RenderStepped:Connect(function()
		local k = (os.clock() - t0) / dur
		if k >= 1 then
			conn:Disconnect()
			a:Destroy()
			return
		end
		l.Brightness = brightness * (1 - k) ^ 2
	end)
end

-- ===== толчок своего персонажа =====

function FX.knock(v: Vector3)
	local char = player.Character
	if not char then
		return
	end
	local hrp = char:FindFirstChild("HumanoidRootPart")
	local hum = char:FindFirstChildOfClass("Humanoid")
	if not hrp or not hum or hum.Health <= 0 then
		return
	end
	if FX.USE_FLIGHT_KNOCK and char:GetAttribute("FlightState") == "Wings" then
		char:SetAttribute("FlightKnock", v)
		char:SetAttribute("FlightKnockT", workspace:GetServerTimeNow())
	end
	hrp.AssemblyLinearVelocity += v
	if hum.FloorMaterial ~= Enum.Material.Air and v.Y > 5 then
		hum:ChangeState(Enum.HumanoidStateType.Jumping)
	end
end

-- ===== прочее =====

function FX.camPos(): Vector3
	local cam = workspace.CurrentCamera
	return cam and cam.CFrame.Position or Vector3.zero
end

function FX.rootPart(): BasePart?
	local char = player.Character
	return char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
end

-- простая Part для эффектов
function FX.part(props): Part
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = false
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	for k, v in pairs(props) do
		if k ~= "Parent" then
			(p :: any)[k] = v
		end
	end
	if props.Parent then
		p.Parent = props.Parent
	end
	return p
end

return FX

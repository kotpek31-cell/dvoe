--!nonstrict
-- GuardianServer — Страж Храма: каменный великан с треснувшим нимбом на Верхней террасе Храма.
-- Сервер — только «мозг» и хитбокс: невидимая модель с Humanoid (Zone = "World"), фазы по Health,
-- выбор атак, урон через ServerStorage.HaloHooks.damage. Вид, анимация, телеграфы и сцена — GuardianClient
-- по атрибутам модели (G*) и времени сервера.
-- Состояния: dormant → intro (пробуждение, неуязвим) → fight ⇄ transition (между фазами) → dead → (10 мин) → dormant.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")
local CollectionService = game:GetService("CollectionService")
local RunService = game:GetService("RunService")

local Arch = ReplicatedStorage:WaitForChild("Archipelago")
local ConfigF = Arch:WaitForChild("Config")
local Cfg = require(ConfigF:WaitForChild("Guardian"))
local WorldMath = require(Arch:WaitForChild("WorldMath"))
local Clock = require(Arch:WaitForChild("WorldClock"))
local Bus = require(script.Parent:WaitForChild("WorldBus"))
local Prog = require(script.Parent:WaitForChild("Stage4Progress"))

if not Cfg.ENABLED then
	return
end

local Hooks
do
	local ok, h = pcall(function()
		return require(ServerStorage:WaitForChild("HaloHooks", 20))
	end)
	if ok and type(h) == "table" and type(h.damage) == "function" then
		Hooks = h
	else
		warn("[GuardianServer] нет ServerStorage.HaloHooks — Страж выключен")
		return
	end
end

local remote = Bus.remote("Guardian")
local A = Cfg.ATTACKS
local rng = Random.new(math.floor(os.clock() * 1000) % 2147483647)

local function now()
	return workspace:GetServerTimeNow()
end

-- ===== папка и арена =====

local worldArch = workspace:WaitForChild("Archipelago")
local gFolder = worldArch:FindFirstChild("Guardian")
if not gFolder then
	gFolder = Instance.new("Folder")
	gFolder.Name = "Guardian"
	gFolder.Parent = worldArch
end

local function stonePart(props): Part
	local p = Instance.new("Part")
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	for k, v in pairs(props) do
		if k ~= "Parent" then
			(p :: any)[k] = v
		end
	end
	p.Parent = props.Parent
	return p
end

-- запасная арена: круглая белая площадка с бирюзовым кольцом рун и сломанными колоннами
local function buildFallbackArena(center: Vector3, radius: number)
	local old = gFolder:FindFirstChild("Arena")
	if old then
		return old
	end
	local L = Cfg.LOOK
	local m = Instance.new("Model")
	m.Name = "Arena"
	local R = radius + 12
	stonePart({
		Name = "Floor",
		Shape = Enum.PartType.Cylinder,
		Size = Vector3.new(8, R * 2, R * 2),
		CFrame = CFrame.new(center - Vector3.new(0, 4, 0)) * CFrame.Angles(0, 0, math.rad(90)),
		Color = L.STONE,
		Material = Enum.Material.Marble,
		Parent = m,
	})
	-- скала под площадкой (сужается книзу)
	for i, k in ipairs({ 0.9, 0.72, 0.5, 0.28 }) do
		stonePart({
			Name = "Rock",
			Shape = Enum.PartType.Cylinder,
			Size = Vector3.new(16, R * 2 * k, R * 2 * k),
			CFrame = CFrame.new(center - Vector3.new(0, 8 + i * 15, 0)) * CFrame.Angles(0, 0, math.rad(90)),
			Color = L.STONE_DARK:Lerp(Color3.fromRGB(120, 110, 130), i / 4),
			Material = Enum.Material.Slate,
			Parent = m,
		})
	end
	-- кольцо рун
	local N = 48
	for i = 1, N do
		local a = (i - 0.5) / N * math.pi * 2
		local r = radius - 6
		stonePart({
			Name = "Rune",
			Size = Vector3.new(0.8, 0.3, 2 * r * math.sin(math.pi / N) * (i % 3 == 0 and 0.4 or 0.9)),
			CFrame = CFrame.new(center + Vector3.new(math.cos(a) * r, 0.1, math.sin(a) * r)) * CFrame.Angles(0, -a, 0),
			Color = L.GLOW,
			Material = Enum.Material.Neon,
			CanCollide = false,
			CanQuery = false,
			Parent = m,
		})
	end
	-- сломанные колонны по краю (за них можно спрятаться от камнепада — нет; от лучей — нет: это просто вид)
	for i = 1, 8 do
		local a = (i - 0.5) / 8 * math.pi * 2 + 0.2
		local r = radius + 4
		local h = 10 + ((i * 37) % 5) * 5
		stonePart({
			Name = "Pillar",
			Shape = Enum.PartType.Cylinder,
			Size = Vector3.new(h, 6, 6),
			CFrame = CFrame.new(center + Vector3.new(math.cos(a) * r, h * 0.5, math.sin(a) * r)) * CFrame.Angles(0, 0, math.rad(90)),
			Color = L.STONE,
			Material = Enum.Material.Marble,
			Parent = m,
		})
		stonePart({
			Name = "PillarGlow",
			Size = Vector3.new(0.4, h * 0.7, 0.4),
			CFrame = CFrame.new(center + Vector3.new(math.cos(a) * (r - 3.05), h * 0.45, math.sin(a) * (r - 3.05))),
			Color = L.GLOW,
			Material = Enum.Material.Neon,
			CanCollide = false,
			CanQuery = false,
			Parent = m,
		})
	end
	m.ModelStreamingMode = Enum.ModelStreamingMode.Atomic
	m.Parent = gFolder
	return m
end

local function findArena(): (Vector3, number)
	for _, p in ipairs(CollectionService:GetTagged(Cfg.ARENA_TAG)) do
		if p:IsA("BasePart") and p:IsDescendantOf(workspace) then
			return p.Position + Vector3.new(0, p.Size.Y * 0.5, 0), (p:GetAttribute("Radius") or Cfg.ARENA_RADIUS)
		end
	end
	local center = Clock.ORIGIN + Cfg.ARENA_FALLBACK
	if Cfg.BUILD_FALLBACK_ARENA then
		buildFallbackArena(center, Cfg.ARENA_RADIUS)
	end
	return center, Cfg.ARENA_RADIUS
end

local ARENA, RADIUS = findArena()
local FLOOR = ARENA.Y

-- ===== хитбокс-модель =====

local model: Model
local hum: Humanoid
local root: BasePart
local yaw = 0

local HIT = {
	{ "Legs", Vector3.new(12, 10, 8), Vector3.new(0, 5, 0), true },
	{ "Torso", Vector3.new(15, 11, 9), Vector3.new(0, 16, 0), true },
	{ "Head", Vector3.new(7.5, 7, 7.5), Vector3.new(0, 25, 0), false },
	{ "ArmR", Vector3.new(5.5, 14, 5.5), Vector3.new(10.5, 14, 0), false },
	{ "ArmL", Vector3.new(5.5, 14, 5.5), Vector3.new(-10.5, 14, 0), false },
}

local function rootCF(): CFrame
	return CFrame.new(ARENA + Vector3.new(0, 10, 0)) * CFrame.Angles(0, yaw, 0)
end

local function placeModel()
	if model and model.PrimaryPart then
		model:PivotTo(rootCF())
	end
end

local function newHumanoid(health: number, maxHealth: number)
	local h = Instance.new("Humanoid")
	h.Name = "Humanoid"
	h.RequiresNeck = false
	h.BreakJointsOnDeath = false
	h.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
	h.HealthDisplayType = Enum.HumanoidHealthDisplayType.AlwaysOff
	h.NameDisplayDistance = 0
	h.MaxHealth = maxHealth
	h.Health = health
	h.WalkSpeed = 0
	h.JumpPower = 0
	h.AutoRotate = false
	h.Parent = model
	return h
end

local function buildModel()
	model = Instance.new("Model")
	model.Name = "TempleGuardian"
	model:SetAttribute("Zone", "World")
	model:SetAttribute("DisplayName", Cfg.NAME)
	root = stonePart({
		Name = "HumanoidRootPart",
		Size = Vector3.new(8, 8, 8),
		Transparency = 1,
		CanCollide = false,
		CanQuery = true,
		CanTouch = true,
		CFrame = rootCF(),
		Parent = model,
	})
	model.PrimaryPart = root
	for _, h in ipairs(HIT) do
		stonePart({
			Name = h[1],
			Size = h[2],
			Transparency = 1,
			CanCollide = h[4],
			CanQuery = true,
			CanTouch = true,
			CFrame = rootCF() * CFrame.new(h[3] - Vector3.new(0, 10, 0)),
			Parent = model,
		})
	end
	model.ModelStreamingMode = Enum.ModelStreamingMode.Atomic
	model:SetAttribute("GArena", ARENA)
	model:SetAttribute("GFloor", FLOOR)
	model:SetAttribute("GRadius", RADIUS)
	model.Parent = gFolder
end

buildModel()

-- ===== состояние =====

local G = {
	state = "dormant" :: string,
	phase = 1,
	invuln = true,
	lockHp = 0,
	action = nil, -- {name, t0, tEnd}
	nextAt = 0,
	emptySince = nil,
	respawnAt = 0,
	actN = 0,
	fightTime = {}, -- [plr] = секунд в бою
	inWake = {}, -- [plr] = секунд рядом (для «встретил»)
	hitBy = {}, -- [action N] = {[humanoid] = true}
	events = {}, -- {t, fn}
	maxHp = Cfg.HEALTH.BASE,
	introT0 = 0,
	fighters = 0,
}

local function setAttr(k, v)
	model:SetAttribute(k, v)
end

-- (через функцию: внутри отложенных событий анализатор не «сужает» тип состояния)
local function stateIs(s: string): boolean
	return G.state == s
end

local function setState(s: string)
	G.state = s
	setAttr("GState", s)
end

local function setInvuln(v: boolean)
	G.invuln = v
	setAttr("GInvuln", v)
	if v and hum then
		G.lockHp = hum.Health
	end
end

-- снять текущую атаку: её ждущие удары гаснут (события состояния — пробуждение, переход — остаются)
local function clearAction()
	G.action = nil
	for i = #G.events, 1, -1 do
		if not G.events[i].keep then
			table.remove(G.events, i)
		end
	end
	setAttr("GAct", "")
end

local function clearAll()
	G.action = nil
	G.events = {}
	setAttr("GAct", "")
end

-- ===== Humanoid: неуязвимость, пороги фаз, «не умирать раньше времени» =====

local restoring = false
local lastHp = 0
local connections = {}

local onHealth -- объявлено ниже
local onDied

local function attachHumanoid(h: Humanoid)
	for _, c in ipairs(connections) do
		c:Disconnect()
	end
	connections = {}
	hum = h
	lastHp = h.Health
	table.insert(connections, h.HealthChanged:Connect(function(v)
		onHealth(v)
	end))
	table.insert(connections, h.Died:Connect(function()
		onDied()
	end))
end

local function replaceHumanoid(health: number)
	-- Humanoid умер раньше финала (огромный урон разом) — ставим новый, бой продолжается
	local old = hum
	local h = newHumanoid(math.max(1, health), G.maxHp)
	attachHumanoid(h)
	if old and old.Parent then
		old:Destroy()
	end
end

local function setHealth(v: number)
	restoring = true
	hum.Health = v
	restoring = false
	lastHp = hum.Health
end

local function finalPhase(): boolean
	return G.phase >= #Cfg.PHASES
end

local startTransition -- ниже
local die
local wake

onHealth = function(v: number)
	if restoring or not hum then
		return
	end
	if G.state == "dormant" then
		-- ударили спящего издалека — просыпается, урон не проходит
		if v < lastHp then
			setHealth(lastHp)
			wake()
		end
		return
	end
	if G.state ~= "fight" or G.invuln then
		if v < lastHp then
			setHealth(math.max(lastHp, 1))
		end
		return
	end
	local frac = v / hum.MaxHealth
	local nextTh = Cfg.PHASES[G.phase + 1]
	if nextTh and frac <= nextTh then
		-- порог фазы: дальше урон не проходит, пока не кончится переход
		setHealth(nextTh * hum.MaxHealth)
		startTransition()
		return
	end
	if v <= 0 and finalPhase() then
		die()
		return
	end
	lastHp = v
end

onDied = function()
	if G.state == "dead" then
		return
	end
	if G.state == "fight" and not G.invuln and finalPhase() then
		die()
		return
	end
	-- смерть не вовремя (неуязвим/не последняя фаза) — оживляем на пороге
	local keep = math.max(lastHp, 1)
	local nextTh = Cfg.PHASES[G.phase + 1]
	if G.state == "fight" and nextTh then
		keep = nextTh * G.maxHp
	end
	task.defer(function()
		replaceHumanoid(keep)
		if G.state == "fight" and nextTh then
			startTransition()
		end
	end)
end

attachHumanoid(newHumanoid(G.maxHp, G.maxHp))
setState("dormant")
setInvuln(true)
setAttr("GPhase", 1)
setAttr("GMaxHp", G.maxHp)
setAttr("GActN", 0)
clearAction()

-- ===== бойцы =====

local function inArena(pos: Vector3, reach: number): boolean
	local flat = Vector3.new(pos.X - ARENA.X, 0, pos.Z - ARENA.Z).Magnitude
	local up = pos.Y - FLOOR
	-- та же полоса высот, что у ударов (ноги выше пола): кто ниже пола — не боец, не цель и без награды
	return flat <= reach and up > 0 and up <= Cfg.LEASH_UP
end

-- список целей: игроки в мире + копии «Лжи» (Hooks.decoys)
local function fighters(reachIn: number?)
	local reach: number = reachIn or Cfg.LEASH
	local list = {}
	for _, plr in ipairs(Players:GetPlayers()) do
		if Bus.inWorld(plr) then
			local hrp, h, char = Bus.body(plr)
			if hrp and inArena(hrp.Position, reach) then
				local can = true
				if type(Hooks.canAttack) == "function" then
					local ok, r = pcall(Hooks.canAttack, plr)
					can = not ok or r ~= false
				end
				if can then
					table.insert(list, { kind = "player", plr = plr, hrp = hrp, hum = h, char = char })
				end
			end
		end
	end
	if type(Hooks.decoys) == "table" then
		for m, d in pairs(Hooks.decoys) do
			if type(d) == "table" and d.hrp and d.hum and d.hum.Health > 0 and d.hrp.Parent then
				if inArena(d.hrp.Position, reach) then
					table.insert(list, { kind = "decoy", model = m, hrp = d.hrp, hum = d.hum, char = m })
				end
			end
		end
	end
	return list
end

local function heightOf(f): number
	-- ноги над полом (≈ HRP − 3)
	return f.hrp.Position.Y - 3 - FLOOR
end

local function flatDist(a: Vector3, b: Vector3): number
	return Vector3.new(a.X - b.X, 0, a.Z - b.Z).Magnitude
end

-- ===== урон =====

local function damage(f, amount: number, knock: Vector3?, actId: number)
	G.hitBy[actId] = G.hitBy[actId] or {}
	local set = G.hitBy[actId]
	if set[f.hum] then
		return false
	end
	set[f.hum] = true
	local ok = pcall(Hooks.damage, f.hum, amount, model)
	if f.kind == "player" then
		Bus.foldWings(f.char, "guardian")
		if knock then
			remote:FireClient(f.plr, "knock", knock)
		end
		remote:FireClient(f.plr, "hit", amount)
	end
	return ok
end

-- урон тиками (лучи): своя метка по времени
local tickHit = {} -- [humanoid] = время следующего тика
local function damageTick(f, amount: number, period: number)
	local t = now()
	if (tickHit[f.hum] or 0) > t then
		return
	end
	tickHit[f.hum] = t + period * 0.95
	pcall(Hooks.damage, f.hum, amount, model)
	if f.kind == "player" then
		Bus.foldWings(f.char, "guardian")
		remote:FireClient(f.plr, "hit", amount)
	end
end

local function outward(from: Vector3, to: Vector3, power: number, up: number): Vector3
	local d = Vector3.new(to.X - from.X, 0, to.Z - from.Z)
	if d.Magnitude < 0.1 then
		d = Vector3.new(rng:NextNumber(-1, 1), 0, rng:NextNumber(-1, 1))
	end
	return d.Unit * power + Vector3.new(0, up, 0)
end

-- ===== расписание =====

-- keep = событие состояния (не гаснет вместе с атакой)
local function at(t: number, fn, keep: boolean?)
	table.insert(G.events, { t = t, fn = fn, keep = keep == true })
end

-- ===== атаки =====

local function beginAction(name: string, target: Vector3?, extra)
	G.actN += 1
	local t0 = now()
	local def = A[name]
	local total = def.windup + (def.duration or 0) + def.recover
	G.action = { name = name, t0 = t0, tEnd = t0 + total, n = G.actN }
	G.hitBy = {}
	setAttr("GActT0", t0)
	setAttr("GActTarget", target or ARENA)
	setAttr("GActDir", yaw)
	setAttr("GActSeed", rng:NextInteger(1, 1e6))
	if extra then
		for k, v in pairs(extra) do
			setAttr(k, v)
		end
	end
	setAttr("GAct", name)
	setAttr("GActN", G.actN) -- последним: клиенты по нему стартуют действие
	return t0, G.actN
end

local function doSlam(target)
	local def = A.slam
	local spot = Vector3.new(target.hrp.Position.X, FLOOR, target.hrp.Position.Z)
	local t0, id = beginAction("slam", spot)
	at(t0 + def.windup, function()
		for _, f in ipairs(fighters()) do
			local d = flatDist(f.hrp.Position, spot)
			local h = heightOf(f)
			if d <= def.radius and h > -3 and h < 14 then
				damage(f, def.damage, outward(spot, f.hrp.Position, def.knock, def.knock * 0.55), id)
			elseif d <= def.ring and h > -3 and h < 5 then
				damage(f, def.ringDamage, outward(spot, f.hrp.Position, def.knock * 0.6, def.knock * 0.35), id)
			end
		end
	end)
end

local function doSweep(target)
	-- взмах — в того, кто рядом (ради него и выбран)
	local v = target.hrp.Position - ARENA
	yaw = math.atan2(-v.X, -v.Z)
	placeModel()
	local def = A.sweep
	local t0, id = beginAction("sweep", nil)
	local face = yaw
	at(t0 + def.windup, function()
		local fwd = Vector3.new(-math.sin(face), 0, -math.cos(face))
		local half = math.rad(def.arc * 0.5)
		for _, f in ipairs(fighters()) do
			local v = Vector3.new(f.hrp.Position.X - ARENA.X, 0, f.hrp.Position.Z - ARENA.Z)
			local d = v.Magnitude
			local h = heightOf(f)
			if d <= def.radius and h > -3 and h < 14 then
				local ang = (d > 0.1) and math.acos(math.clamp(v.Unit:Dot(fwd), -1, 1)) or 0
				if ang <= half then
					local side = Vector3.new(-fwd.Z, 0, fwd.X)
					damage(f, def.damage, (outward(ARENA, f.hrp.Position, def.knock, 0) + side * def.knock * 0.5) + Vector3.new(0, def.knock * 0.45, 0), id)
				end
			end
		end
	end)
end

local function doQuake()
	local def = A.quake
	local t0, id = beginAction("quake", nil)
	local tS = t0 + def.windup
	-- атака длится, пока кольцо не дойдёт до края (иначе очистка снимет его шаги раньше)
	G.action.tEnd = math.max(G.action.tEnd, tS + (def.maxR + def.width) / def.speed + def.recover)
	local function step()
		local r = def.speed * (now() - tS)
		if r > def.maxR + def.width then
			return
		end
		for _, f in ipairs(fighters()) do
			local d = flatDist(f.hrp.Position, ARENA)
			local h = heightOf(f)
			if math.abs(d - r) <= def.width * 0.5 + 1 and h > -3 and h < def.height then
				damage(f, def.damage, outward(ARENA, f.hrp.Position, def.knock, def.knock * 0.6), id)
			end
		end
		at(now() + 0.05, step)
	end
	at(tS, step)
end

local function doBeams()
	tickHit = {}
	local def = A.beams
	local n = def.count[G.phase] or 3
	local sign = (rng:NextNumber() < 0.5) and -1 or 1
	local t0 = beginAction("beams", nil, { GActCount = n, GActSign = sign })
	local tS = t0 + def.windup
	local tE = tS + def.duration
	local base = yaw
	local turn = math.rad(def.turn) * sign
	local function step()
		local t = now()
		if t > tE then
			return
		end
		for _, f in ipairs(fighters()) do
			local v = Vector3.new(f.hrp.Position.X - ARENA.X, 0, f.hrp.Position.Z - ARENA.Z)
			local d = v.Magnitude
			local h = heightOf(f)
			-- тело игрока 0..5 над ногами; луч — height ± thick/2
			if d > 5 and d <= def.length and h > -3 and h < def.height + def.thick * 0.5 and h + 5 > def.height - def.thick * 0.5 then
				local a = math.atan2(-v.X, -v.Z) -- тот же отсчёт, что у yaw (вперёд = -Z)
				local halfW = math.atan2(def.thick * 0.5 + 1.3, d)
				for i = 0, n - 1 do
					local beamA = base + i * (2 * math.pi / n) + turn * (t - tS)
					local diff = (a - beamA + math.pi) % (2 * math.pi) - math.pi
					if math.abs(diff) <= halfW then
						damageTick(f, def.damage, def.tick)
						break
					end
				end
			end
		end
		-- проверяем часто (луч крутится), урон всё равно не чаще def.tick на игрока
		at(t + 0.05, step)
	end
	at(tS, step)
end

local function doRubble()
	local def = A.rubble
	local spots = {}
	local fs = fighters()
	for _, f in ipairs(fs) do
		for _ = 1, def.perFighter do
			local a = rng:NextNumber(0, math.pi * 2)
			local r = rng:NextNumber(0, def.spread)
			table.insert(spots, Vector3.new(f.hrp.Position.X + math.cos(a) * r, FLOOR, f.hrp.Position.Z + math.sin(a) * r))
		end
	end
	for _ = 1, def.extra do
		local a = rng:NextNumber(0, math.pi * 2)
		local r = math.sqrt(rng:NextNumber()) * RADIUS * 0.85
		table.insert(spots, Vector3.new(ARENA.X + math.cos(a) * r, FLOOR, ARENA.Z + math.sin(a) * r))
	end
	local t0, id = beginAction("rubble", nil)
	local tFall = t0 + def.windup
	remote:FireAllClients("rubble", spots, tFall, G.actN)
	at(tFall, function()
		for _, f in ipairs(fighters()) do
			for _, s in ipairs(spots) do
				local h = heightOf(f)
				if flatDist(f.hrp.Position, s) <= def.radius and h > -3 and h <= Cfg.LEASH_UP then
					damage(f, def.damage, outward(s, f.hrp.Position, 55, 40), id)
					break
				end
			end
		end
	end)
end

-- ===== выбор атаки =====

local function pickTarget(list)
	if #list == 0 then
		return nil
	end
	-- кто стоит на арене — в приоритете (по летающим бьёт только камнепад)
	local grounded = {}
	for _, f in ipairs(list) do
		if heightOf(f) < 14 then
			table.insert(grounded, f)
		end
	end
	if #grounded > 0 then
		list = grounded
	end
	if rng:NextNumber() < 0.6 then
		local best, bd = nil, math.huge
		for _, f in ipairs(list) do
			local d = flatDist(f.hrp.Position, ARENA)
			if d < bd then
				best, bd = f, d
			end
		end
		return best
	end
	return list[rng:NextInteger(1, #list)]
end

local function chooseAttack(target)
	-- цель высоко над полом — достанет только камнепад (в любой фазе)
	if heightOf(target) > 14 then
		return "rubble"
	end
	local d = flatDist(target.hrp.Position, ARENA)
	local weights = {}
	for name, def in pairs(A) do
		local w = def.weight[G.phase] or 0
		if name == "slam" and d > def.range then
			w = 0
		elseif name == "sweep" and d > def.close then
			w = 0
		end
		weights[name] = w
	end
	return WorldMath.pickWeighted(weights, rng:NextNumber()) or "quake"
end

local function startAttack(list)
	local target = pickTarget(list)
	if not target then
		return
	end
	G.target = target
	local name = chooseAttack(target)
	if name == "slam" then
		doSlam(target)
	elseif name == "sweep" then
		doSweep(target)
	elseif name == "quake" then
		doQuake()
	elseif name == "beams" then
		doBeams()
	else
		doRubble()
	end
end

-- ===== переходы =====

local function scaleHealth(n: number)
	local H = Cfg.HEALTH
	local k = math.clamp(n, 1, H.MAX_FIGHTERS)
	local want = H.BASE + H.PER_EXTRA * (k - 1)
	if want > G.maxHp then
		local frac = hum.Health / hum.MaxHealth
		G.maxHp = want
		restoring = true
		hum.MaxHealth = want
		hum.Health = want * frac
		restoring = false
		lastHp = hum.Health
		setAttr("GMaxHp", want)
	end
end

wake = function()
	if G.state ~= "dormant" then
		return
	end
	clearAction()
	setState("intro")
	setInvuln(true)
	G.introT0 = now()
	setAttr("GIntroT0", G.introT0)
	at(G.introT0 + Cfg.INTRO * 0.62, function()
		-- рёв пробуждения: волна отталкивает (без урона)
		for _, f in ipairs(fighters(45)) do
			if f.kind == "player" then
				remote:FireClient(f.plr, "knock", outward(ARENA, f.hrp.Position, 55, 30))
			end
		end
	end, true)
	at(G.introT0 + Cfg.INTRO, function()
		if not stateIs("intro") then
			return
		end
		G.maxHp = Cfg.HEALTH.BASE
		restoring = true
		hum.MaxHealth = G.maxHp
		hum.Health = G.maxHp
		restoring = false
		lastHp = G.maxHp
		setAttr("GMaxHp", G.maxHp)
		local nPlayers = 0
		for _, f in ipairs(fighters()) do
			if f.kind == "player" then
				nPlayers += 1
			end
		end
		scaleHealth(nPlayers)
		G.phase = 1
		setAttr("GPhase", 1)
		setState("fight")
		setInvuln(false)
		G.nextAt = now() + 0.8
		G.emptySince = nil
	end, true)
end

startTransition = function()
	if G.state ~= "fight" then
		return
	end
	clearAction()
	setState("transition")
	setInvuln(true)
	local t0 = now()
	setAttr("GTransT0", t0)
	at(t0 + 0.8, function()
		for _, f in ipairs(fighters(42)) do
			if f.kind == "player" then
				remote:FireClient(f.plr, "knock", outward(ARENA, f.hrp.Position, 70, 35))
			end
		end
	end, true)
	at(t0 + Cfg.TRANSITION, function()
		if not stateIs("transition") then
			return
		end
		G.phase = math.min(G.phase + 1, #Cfg.PHASES)
		setAttr("GPhase", G.phase)
		setState("fight")
		setInvuln(false)
		G.nextAt = now() + 0.9
	end, true)
end

local function reward()
	local R = Cfg.REWARD
	for plr, secs in pairs(G.fightTime) do
		if plr.Parent and secs >= Cfg.FIGHT_MIN then
			if not Prog.flag(plr, "guardian_win") then
				Prog.setFlag(plr, "guardian_win")
				local got = {}
				if Prog.add(plr, "shards", R.shard) then
					table.insert(got, "shard")
				end
				if Prog.add(plr, "lore", R.lore) then
					table.insert(got, "lore")
				end
				if Prog.add(plr, "cosmetics", R.cosmetic) then
					table.insert(got, "cosmetic")
				end
				remote:FireClient(plr, "reward", got)
			else
				remote:FireClient(plr, "reward", {})
			end
		end
	end
end

local respawn

die = function()
	if G.state == "dead" then
		return
	end
	clearAll()
	setState("dead")
	setInvuln(true)
	local t = now()
	setAttr("GDeathT", t)
	G.respawnAt = t + Cfg.RESPAWN
	setAttr("GRespawnAt", G.respawnAt)
	reward()
	G.fightTime = {}
	-- рассыпался — через 8 с хитбокс убираем до возрождения
	task.delay(8, function()
		if G.state == "dead" and model.Parent then
			model.Parent = ServerStorage
		end
	end)
end

respawn = function()
	if Hooks.voidWorld then
		return false
	end
	clearAll()
	G.phase = 1
	G.maxHp = Cfg.HEALTH.BASE
	setAttr("GPhase", 1)
	setAttr("GMaxHp", G.maxHp)
	yaw = 0
	model.Parent = gFolder
	placeModel()
	if not hum or hum.Health <= 0 or hum:GetState() == Enum.HumanoidStateType.Dead then
		replaceHumanoid(G.maxHp)
	end
	restoring = true
	hum.MaxHealth = G.maxHp
	hum.Health = G.maxHp
	restoring = false
	lastHp = G.maxHp
	setState("dormant")
	setInvuln(true)
	G.emptySince = nil
	return true
end

local function resetToDormant()
	clearAll()
	G.phase = 1
	G.maxHp = Cfg.HEALTH.BASE
	setAttr("GPhase", 1)
	setAttr("GMaxHp", G.maxHp)
	restoring = true
	hum.MaxHealth = G.maxHp
	hum.Health = G.maxHp
	restoring = false
	lastHp = G.maxHp
	setState("dormant")
	setInvuln(true)
	G.fightTime = {}
	G.emptySince = nil
end

-- ===== шина: панель разработчика и проверка =====

Bus.serve("Guardian", function(cmd)
	if cmd == "spawn" then
		if G.state == "dead" then
			return respawn(), G.state
		end
		return true, G.state
	elseif cmd == "reset" then
		if G.state == "dead" then
			respawn()
		else
			resetToDormant()
		end
		return true, G.state
	elseif cmd == "wake" then
		wake()
		return true, G.state
	elseif cmd == "kill" then
		-- для проверки: сразу финальная фаза и смерть
		if G.state == "dormant" or G.state == "intro" then
			return false, "сначала разбуди (wake) и дождись боя"
		end
		G.phase = #Cfg.PHASES
		setAttr("GPhase", G.phase)
		setState("fight")
		setInvuln(false)
		die()
		return true, G.state
	elseif cmd == "info" then
		return {
			state = G.state,
			phase = G.phase,
			health = hum and hum.Health or 0,
			maxHealth = hum and hum.MaxHealth or 0,
			arena = ARENA,
			radius = RADIUS,
			action = G.action and G.action.name or "",
			respawnIn = (G.state == "dead") and (G.respawnAt - now()) or 0,
			model = model.Parent ~= nil,
			hasHumanoid = hum ~= nil and hum.Parent == model,
			zone = model:GetAttribute("Zone"),
		}
	end
	return nil
end)

-- ===== главный цикл =====

local thinkAcc = 0
RunService.Heartbeat:Connect(function(dt)
	local t = now()

	-- мир заморожен: стоим, ждущие удары и камни гаснут
	local frozen = Hooks.worldFrozen == true
	if model:GetAttribute("GFrozen") ~= frozen then
		setAttr("GFrozen", frozen)
		if frozen then
			clearAction()
		end
	end
	if frozen then
		return
	end

	-- события
	if #G.events > 0 then
		local due = {}
		for i = #G.events, 1, -1 do
			local e = G.events[i]
			if t >= e.t then
				table.remove(G.events, i)
				table.insert(due, e)
			end
		end
		for i = #due, 1, -1 do
			local ok, err = pcall(due[i].fn)
			if not ok then
				warn("[GuardianServer] " .. tostring(err))
			end
		end
	end

	thinkAcc += dt
	if thinkAcc < 0.1 then
		return
	end
	local step = thinkAcc
	thinkAcc = 0

	if G.state == "dead" then
		if t >= G.respawnAt then
			respawn()
		end
		return
	end

	local list = fighters()

	-- «встретил Стража»: побыл рядом MET_DELAY секунд
	for _, f in ipairs(list) do
		if f.kind == "player" and flatDist(f.hrp.Position, ARENA) <= Cfg.WAKE_RADIUS then
			G.inWake[f.plr] = (G.inWake[f.plr] or 0) + step
			if G.inWake[f.plr] >= Cfg.MET_DELAY and f.plr:GetAttribute("ArchGuardianMet") ~= true then
				f.plr:SetAttribute("ArchGuardianMet", true)
				Prog.setFlag(f.plr, "guardian_met")
			end
		end
	end

	if G.state == "dormant" then
		for _, f in ipairs(list) do
			if flatDist(f.hrp.Position, ARENA) <= Cfg.WAKE_RADIUS then
				wake()
				break
			end
		end
		return
	end

	-- никого — через RESET_EMPTY сброс
	if #list == 0 then
		G.emptySince = G.emptySince or t
		if t - G.emptySince >= Cfg.RESET_EMPTY then
			resetToDormant()
		end
		return
	end
	G.emptySince = nil

	if G.state ~= "fight" then
		return
	end

	-- участие (для награды) и рост здоровья, если бойцов стало больше
	local nPlayers = 0
	for _, f in ipairs(list) do
		if f.kind == "player" then
			nPlayers += 1
			G.fightTime[f.plr] = (G.fightTime[f.plr] or 0) + step
		end
	end
	scaleHealth(nPlayers)

	-- поворот к цели (во время лучей стоит)
	local busy = G.action ~= nil
	if not (busy and G.action.name == "beams") then
		local target = G.target
		if not target or not target.hrp.Parent then
			target = pickTarget(list)
			G.target = target
		end
		if target then
			local v = target.hrp.Position - ARENA
			local want = math.atan2(-v.X, -v.Z)
			local diff = (want - yaw + math.pi) % (2 * math.pi) - math.pi
			local maxStep = math.rad(Cfg.TURN_SPEED) * step
			yaw += math.clamp(diff, -maxStep, maxStep)
			placeModel()
		end
	end

	-- конец действия → пауза → следующая атака
	if busy and t >= G.action.tEnd then
		clearAction()
		local gap = Cfg.GAP[G.phase] or { 1.5, 2 }
		G.nextAt = t + rng:NextNumber(gap[1], gap[2])
	end
	if not G.action and t >= G.nextAt then
		startAttack(list)
	end
end)

Players.PlayerRemoving:Connect(function(plr)
	G.fightTime[plr] = nil
	G.inWake[plr] = nil
end)

-- «уже встречал» из сохранения → атрибут (сцена-знакомство не повторяется в следующих входах).
-- Профиль грузится после входа — слушаем изменение атрибута набора флагов.
local function restoreMet(plr: Player)
	if plr:GetAttribute("ArchGuardianMet") ~= true and Prog.flag(plr, "guardian_met") then
		plr:SetAttribute("ArchGuardianMet", true)
	end
end
local function hookMet(plr: Player)
	restoreMet(plr)
	plr:GetAttributeChangedSignal(Prog.attrName("flags")):Connect(function()
		restoreMet(plr)
	end)
end
Players.PlayerAdded:Connect(hookMet)
for _, p in ipairs(Players:GetPlayers()) do
	hookMet(p)
end

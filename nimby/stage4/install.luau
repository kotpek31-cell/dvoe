--!nonstrict
-- install.luau — ставит файлы этапа 4 «Живой мир» в плейс. СГЕНЕРИРОВАНО: node nimby/tools/build-install.mjs
-- Запуск: Studio, НЕ в Play. Command Bar или execute_luau. Повторный запуск безопасен:
-- уже стоящий скрипт с тем же именем копируется в ServerStorage.Backup_<Имя>_<ДДММ> и обновляется.
-- Существующие скрипты этапов 0–3 не трогает (DevPanelServer — вручную по patches/DevPanelServer.md).

local ChangeHistoryService = game:GetService("ChangeHistoryService")
local ServerStorage = game:GetService("ServerStorage")
local rec = ChangeHistoryService:TryBeginRecording("Nimby stage 4 install")
local stamp = os.date("%d%m")

local function root(name)
	if name == "StarterPlayerScripts" then
		return game:GetService("StarterPlayer"):WaitForChild("StarterPlayerScripts")
	end
	return game:GetService(name)
end

local function folder(parent, name)
	local f = parent:FindFirstChild(name)
	if not f then
		f = Instance.new("Folder")
		f.Name = name
		f.Parent = parent
	end
	return f
end

local made, updated = 0, 0
local function put(path, class, source)
	local segs = string.split(path, "/")
	local node = root(segs[1])
	for i = 2, #segs - 1 do
		node = folder(node, segs[i])
	end
	local name = segs[#segs]
	local old = node:FindFirstChild(name)
	if old and old:IsA("LuaSourceContainer") then
		local bk = old:Clone()
		bk.Name = "Backup_" .. name .. "_" .. stamp
		bk.Parent = ServerStorage
		if old.ClassName ~= class then
			old:Destroy()
			old = nil
		end
	elseif old then
		error("[stage4] " .. path .. " уже занят не-скриптом (" .. old.ClassName .. ")")
	end
	local s = old or Instance.new(class)
	s.Name = name
	s.Source = source
	s.Parent = node
	if old then
		updated += 1
	else
		made += 1
	end
end

put("ReplicatedStorage/Archipelago/Assets/GuardianBuilder", "ModuleScript", [==[
--!nonstrict
-- GuardianBuilder — видимый Страж Храма (только клиент): каменный великан ~28 стад из белого мрамора,
-- бирюзовые руны и ядро в груди, щель-визор с глазами, огромные кулаки, треснувший нимб над головой.
-- Возвращает скелет: кости (сустав относительно родителя) и части на костях. Анимирует GuardianClient
-- пружинами по позам (POSES) — замах → удар с перелётом → восстановление.

local GuardianBuilder = {}

-- кости: имя, родитель, сустав (в системе родителя)
local BONES = {
	{ "pelvis", nil, CFrame.new(0, 10, 0) },
	{ "waist", "pelvis", CFrame.new(0, 2, 0) },
	{ "neck", "waist", CFrame.new(0, 10.6, 0) },
	{ "halo", "neck", CFrame.new(0, 8.6, 0) },
	{ "shR", "waist", CFrame.new(8.3, 8.4, 0) },
	{ "elR", "shR", CFrame.new(0, -6.4, 0) },
	{ "shL", "waist", CFrame.new(-8.3, 8.4, 0) },
	{ "elL", "shL", CFrame.new(0, -6.4, 0) },
	{ "hipR", "pelvis", CFrame.new(3.6, -1.2, 0) },
	{ "knR", "hipR", CFrame.new(0, -4.6, 0) },
	{ "hipL", "pelvis", CFrame.new(-3.6, -1.2, 0) },
	{ "knL", "hipL", CFrame.new(0, -4.6, 0) },
}
GuardianBuilder.BONES = BONES

-- позы: кость → {x, y, z} в градусах. rootY — сдвиг таза, haloUp — подъём нимба, f/z — пружина (Гц, затухание)
-- Знаки: +X у руки/ноги — вперёд; +Z у правой руки — в сторону (у левой −Z); −X у корпуса/головы — наклон вперёд;
-- −Y у корпуса — поворот вправо.
GuardianBuilder.POSES = {
	idle = {
		shR = { 8, 0, 9 }, shL = { 8, 0, -9 }, elR = { 18, 0, 0 }, elL = { 18, 0, 0 },
		waist = { -4, 0, 0 }, neck = { -4, 0, 0 },
		f = 1.8, z = 0.5,
	},
	kneel = {
		rootY = -4.2,
		hipR = { 92, 0, 0 }, knR = { -92, 0, 0 }, hipL = { -12, 0, 0 }, knL = { -94, 0, 0 },
		waist = { -24, 0, 0 }, neck = { -32, 0, 0 },
		shR = { 38, 0, 10 }, elR = { 42, 0, 0 }, shL = { 22, 0, -16 }, elL = { 60, 0, 0 },
		haloUp = -1.6,
		f = 1.0, z = 0.85,
	},
	slamWind = {
		waist = { 12, -28, 0 }, neck = { 10, 0, 0 },
		shR = { 172, 0, 16 }, elR = { 36, 0, 0 }, shL = { -16, 0, -30 }, elL = { 30, 0, 0 },
		hipR = { -8, 0, 0 }, hipL = { 12, 0, 0 },
		rootY = 0.6,
		f = 2.3, z = 0.45,
	},
	slamHit = {
		waist = { -30, 12, 0 }, neck = { -18, 0, 0 },
		shR = { 72, 0, 8 }, elR = { 6, 0, 0 }, shL = { 20, 0, -36 }, elL = { 40, 0, 0 },
		hipR = { 28, 0, 0 }, knR = { -38, 0, 0 }, hipL = { 30, 0, 0 }, knL = { -40, 0, 0 },
		rootY = -2,
		f = 6.5, z = 0.42,
	},
	sweepWind = {
		waist = { 6, -55, 0 }, neck = { 0, 22, 0 },
		shR = { 40, 0, 82 }, elR = { 12, 0, 0 }, shL = { 30, 0, -20 }, elL = { 30, 0, 0 },
		f = 2.4, z = 0.45,
	},
	sweepHit = {
		waist = { -6, 66, 0 }, neck = { 0, -16, 0 },
		shR = { 82, 0, 40 }, elR = { 0, 0, 0 }, shL = { 12, 0, -40 }, elL = { 20, 0, 0 },
		f = 6.5, z = 0.42,
	},
	quakeWind = {
		shR = { 170, 0, 18 }, shL = { 170, 0, -18 }, elR = { 40, 0, 0 }, elL = { 40, 0, 0 },
		waist = { 14, 0, 0 }, neck = { 18, 0, 0 },
		rootY = 0.8,
		f = 2.0, z = 0.45,
	},
	quakeHit = {
		shR = { 74, 0, 10 }, shL = { 74, 0, -10 }, elR = { 0, 0, 0 }, elL = { 0, 0, 0 },
		waist = { -34, 0, 0 }, neck = { -12, 0, 0 },
		hipR = { 38, 0, 0 }, knR = { -52, 0, 0 }, hipL = { 38, 0, 0 }, knL = { -52, 0, 0 },
		rootY = -3,
		f = 6.5, z = 0.42,
	},
	beam = {
		shR = { 10, 0, 86 }, shL = { 10, 0, -86 }, elR = { 0, 0, 0 }, elL = { 0, 0, 0 },
		waist = { 6, 0, 0 }, neck = { 22, 0, 0 },
		haloUp = 3,
		f = 2.5, z = 0.5,
	},
	summon = {
		shR = { 150, 0, 40 }, shL = { 150, 0, -40 }, elR = { 25, 0, 0 }, elL = { 25, 0, 0 },
		waist = { 14, 0, 0 }, neck = { 30, 0, 0 },
		haloUp = 2,
		f = 2.2, z = 0.45,
	},
	roar = {
		shR = { 30, 0, 62 }, shL = { 30, 0, -62 }, elR = { 46, 0, 0 }, elL = { 46, 0, 0 },
		waist = { 16, 0, 0 }, neck = { 34, 0, 0 },
		rootY = 0.4,
		haloUp = 1.5,
		f = 3.2, z = 0.35,
	},
}

local function mk(model: Model, props): BasePart
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = props.shadow == true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Size = props.size
	p.Color = props.color
	p.Material = props.material or Enum.Material.Marble
	if props.shape then
		p.Shape = props.shape
	end
	if props.transparency then
		p.Transparency = props.transparency
	end
	p.Name = props.name or "Part"
	p.Parent = model
	return p
end

-- L — Config.Guardian.LOOK
function GuardianBuilder.build(L, parent: Instance)
	local model = Instance.new("Model")
	model.Name = "GuardianView"

	local rig = { model = model, bones = {}, order = {}, parts = {}, glow = {}, halo = {}, shards = {}, lights = {} }
	for _, b in ipairs(BONES) do
		rig.bones[b[1]] = { name = b[1], parent = b[2], joint = b[3], parts = {} }
		table.insert(rig.order, b[1])
	end

	local function on(bone: string, part: BasePart, offset: CFrame, glow: boolean?)
		table.insert(rig.bones[bone].parts, { part = part, offset = offset })
		table.insert(rig.parts, part)
		if glow then
			table.insert(rig.glow, part)
		end
		return part
	end

	local S, D, M, GL = L.STONE, L.STONE_DARK, L.MOSS, L.GLOW
	local ball = Enum.PartType.Ball
	local neon = Enum.Material.Neon

	-- таз
	on("pelvis", mk(model, { name = "Hips", size = Vector3.new(10, 4, 7), color = D, shadow = true }), CFrame.new())
	on("pelvis", mk(model, { name = "Belt", size = Vector3.new(10.3, 0.5, 7.3), color = GL, material = neon }), CFrame.new(0, 1.4, 0), true)

	-- корпус
	on("waist", mk(model, { name = "Belly", size = Vector3.new(9, 3.6, 7), color = D, shadow = true }), CFrame.new(0, 1.5, 0))
	on("waist", mk(model, { name = "Chest", size = Vector3.new(13, 9, 8.5), color = S, shadow = true }), CFrame.new(0, 6.2, 0))
	on("waist", mk(model, { name = "ChestPlate", size = Vector3.new(9.5, 5.5, 1), color = S:Lerp(Color3.new(1, 1, 1), 0.3) }), CFrame.new(0, 6.6, -4.4))
	local core = on("waist", mk(model, { name = "Core", size = Vector3.new(3, 3, 3), color = GL, material = neon, shape = ball }), CFrame.new(0, 6.6, -4.9), true)
	rig.core = core
	for _, sx in ipairs({ -1, 1 }) do
		on("waist", mk(model, { name = "Rune", size = Vector3.new(0.45, 5.4, 0.3), color = GL, material = neon }), CFrame.new(sx * 3.4, 6.4, -4.95) * CFrame.Angles(0, 0, math.rad(sx * 22)), true)
		on("waist", mk(model, { name = "Shoulder", size = Vector3.new(6.6, 6.6, 6.6), color = S, shape = ball, shadow = true }), CFrame.new(sx * 7.6, 9, 0))
		on("waist", mk(model, { name = "Moss", size = Vector3.new(2.8, 2.8, 2.8), color = M, shape = ball, material = Enum.Material.Grass }), CFrame.new(sx * 8.1, 11.6, 1.1))
		on("waist", mk(model, { name = "Crack", size = Vector3.new(0.3, 3.6, 0.3), color = GL, material = neon }), CFrame.new(sx * 4.6, 4.2, 4.3) * CFrame.Angles(0, 0, math.rad(-sx * 30)), true)
	end
	local cl = Instance.new("PointLight")
	cl.Color = GL
	cl.Range = 22
	cl.Brightness = 2.2
	cl.Shadows = false
	cl.Parent = core
	table.insert(rig.lights, cl)

	-- голова
	on("neck", mk(model, { name = "Head", size = Vector3.new(6.8, 6, 6.8), color = S, shadow = true }), CFrame.new(0, 3.4, 0))
	on("neck", mk(model, { name = "Brow", size = Vector3.new(7.3, 1.5, 2.2), color = D }), CFrame.new(0, 4.8, -2.9))
	local visor = on("neck", mk(model, { name = "Visor", size = Vector3.new(4.8, 0.75, 0.3), color = GL, material = neon }), CFrame.new(0, 3.6, -3.45), true)
	rig.visor = visor
	on("neck", mk(model, { name = "Jaw", size = Vector3.new(5.8, 1.7, 5.8), color = D }), CFrame.new(0, 0.6, -0.4))
	for _, c in ipairs({ { -2.3, 7.1, 0, -14 }, { 0, 7.6, 0, 0 }, { 2.3, 7.1, 0, 14 } }) do
		on("neck", mk(model, { name = "Crown", size = Vector3.new(1.3, 2.6, 1.3), color = S }), CFrame.new(c[1], c[2], c[3]) * CFrame.Angles(0, 0, math.rad(c[4])))
	end
	local vl = Instance.new("PointLight")
	vl.Color = GL
	vl.Range = 12
	vl.Brightness = 1.6
	vl.Shadows = false
	vl.Parent = visor
	table.insert(rig.lights, vl)

	-- руки
	for _, side in ipairs({ { "R", 1 }, { "L", -1 } }) do
		local sh, el = "sh" .. side[1], "el" .. side[1]
		on(sh, mk(model, { name = "UpperArm", size = Vector3.new(4.3, 6.6, 4.3), color = S, shadow = true }), CFrame.new(0, -3.3, 0))
		on(el, mk(model, { name = "Elbow", size = Vector3.new(4.5, 4.5, 4.5), color = D, shape = ball }), CFrame.new())
		on(el, mk(model, { name = "Forearm", size = Vector3.new(4.9, 5.6, 4.9), color = S, shadow = true }), CFrame.new(0, -2.9, 0))
		on(el, mk(model, { name = "Fist", size = Vector3.new(6.6, 5.6, 6.6), color = S, shadow = true }), CFrame.new(0, -7.7, 0))
		on(el, mk(model, { name = "Knuckles", size = Vector3.new(6.8, 0.6, 6.8), color = GL, material = neon }), CFrame.new(0, -6.2, 0), true)
		rig["fist" .. side[1]] = rig.bones[el].parts[#rig.bones[el].parts - 1].part
	end

	-- ноги
	for _, side in ipairs({ "R", "L" }) do
		local hip, kn = "hip" .. side, "kn" .. side
		on(hip, mk(model, { name = "Thigh", size = Vector3.new(4.7, 4.8, 4.7), color = S, shadow = true }), CFrame.new(0, -2.3, 0))
		on(kn, mk(model, { name = "Knee", size = Vector3.new(4.3, 4.3, 4.3), color = D, shape = ball }), CFrame.new())
		on(kn, mk(model, { name = "Shin", size = Vector3.new(5.1, 4.4, 5.1), color = S, shadow = true }), CFrame.new(0, -2.4, 0))
		on(kn, mk(model, { name = "Foot", size = Vector3.new(6.2, 1.7, 7.8), color = D, shadow = true }), CFrame.new(0, -4.85, -0.8))
	end

	-- треснувший нимб: 16 кусков по кругу, двух нет (трещина), рядом парят осколки
	local N, R = 16, 4.7
	for i = 1, N do
		if i ~= 5 and i ~= 6 then
			local a = (i - 0.5) / N * math.pi * 2
			local seg = mk(model, { name = "HaloSeg", size = Vector3.new(0.9, 0.9, 2 * R * math.sin(math.pi / N) * 1.06), color = GL, material = neon })
			local off = CFrame.new(math.cos(a) * R, 0, math.sin(a) * R) * CFrame.Angles(0, -a, 0)
			on("halo", seg, off, true)
			table.insert(rig.halo, { part = seg, index = i, offset = off })
		end
	end
	for k = 1, 3 do
		local sh = mk(model, { name = "HaloShard", size = Vector3.new(0.6, 0.6, 1.1), color = GL, material = neon })
		local a = (4.6 + k * 0.35) / N * math.pi * 2
		local off = CFrame.new(math.cos(a) * (R + 0.9 + k * 0.3), 0.5 * k - 0.6, math.sin(a) * (R + 0.9 + k * 0.3))
		on("halo", sh, off, true)
		table.insert(rig.shards, { part = sh, offset = off, k = k })
	end

	model.Parent = parent
	return rig
end

-- мировые CFrame всех частей по позе: base — CFrame «пола» под Стражем (с поворотом),
-- ang[кость] = {x, y, z} в радианах, rootY, haloUp, haloSpin
function GuardianBuilder.pose(rig, base: CFrame, ang, rootY: number, haloUp: number, haloSpin: number, extra)
	local world = {}
	local parts, cfs = {}, {}
	for _, name in ipairs(rig.order) do
		local b = rig.bones[name]
		local parentCF = b.parent and world[b.parent] or (base * CFrame.new(0, rootY, 0))
		local a = ang[name]
		local rot = a and CFrame.Angles(a[1], a[2], a[3]) or CFrame.identity
		local cf
		if name == "halo" then
			cf = parentCF * b.joint * CFrame.new(0, haloUp, 0) * CFrame.Angles(0, haloSpin, 0)
		else
			cf = parentCF * b.joint * rot
		end
		world[name] = cf
		for _, p in ipairs(b.parts) do
			local pcf = cf * p.offset
			if extra and extra[p.part] then
				pcf = pcf * extra[p.part]
			end
			table.insert(parts, p.part)
			table.insert(cfs, pcf)
		end
	end
	workspace:BulkMoveTo(parts, cfs, Enum.BulkMoveMode.FireCFrameChanged)
	return world
end

return GuardianBuilder
]==])

put("ReplicatedStorage/Archipelago/Assets/JellyBuilder", "ModuleScript", [==[
--!nonstrict
-- JellyBuilder — облачная медуза кодом (только клиент): полупрозрачный колокол, светящееся ядро,
-- щупальца-лучи (Beam), которые колышутся. Колокол пульсирует и пружинит при прыжке на него.

local JellyBuilder = {}

local TENTACLES = 5

function JellyBuilder.build(item, parent: Instance)
	local size = item.size
	local col = item.color
	local model = Instance.new("Model")
	model.Name = "Jelly"

	local bell = Instance.new("Part")
	bell.Name = "Bell"
	bell.Anchored = true
	bell.CanCollide = false
	bell.CanQuery = false
	bell.CanTouch = false
	bell.CastShadow = false
	bell.Size = Vector3.new(size, size * 0.64, size)
	bell.Color = col
	bell.Material = Enum.Material.Glass
	bell.Transparency = 0.38
	local mesh = Instance.new("SpecialMesh")
	mesh.MeshType = Enum.MeshType.Sphere
	mesh.Parent = bell
	bell.Parent = model

	local rim = Instance.new("Part")
	rim.Name = "Rim"
	rim.Anchored = true
	rim.CanCollide = false
	rim.CanQuery = false
	rim.CanTouch = false
	rim.CastShadow = false
	rim.Size = Vector3.new(size * 1.04, size * 0.16, size * 1.04)
	rim.Color = col:Lerp(Color3.new(1, 1, 1), 0.35)
	rim.Material = Enum.Material.Neon
	rim.Transparency = 0.45
	local rimMesh = Instance.new("SpecialMesh")
	rimMesh.MeshType = Enum.MeshType.Sphere
	rimMesh.Parent = rim
	rim.Parent = model

	local core = Instance.new("Part")
	core.Name = "Core"
	core.Anchored = true
	core.CanCollide = false
	core.CanQuery = false
	core.CanTouch = false
	core.CastShadow = false
	core.Shape = Enum.PartType.Ball
	core.Size = Vector3.new(size * 0.34, size * 0.34, size * 0.34)
	core.Color = col:Lerp(Color3.new(1, 1, 1), 0.55)
	core.Material = Enum.Material.Neon
	core.Parent = model

	-- щупальца: от низа колокола к концам, концы колышутся
	local roots, tips, beams = {}, {}, {}
	for k = 1, TENTACLES do
		local a = (k - 1) / TENTACLES * math.pi * 2
		local r0 = Instance.new("Attachment")
		r0.Position = Vector3.new(math.cos(a) * size * 0.3, -size * 0.18, math.sin(a) * size * 0.3)
		r0.Parent = bell
		local r1 = Instance.new("Attachment")
		r1.Position = Vector3.new(math.cos(a) * size * 0.36, -size * (1.2 + 0.25 * (k % 2)), math.sin(a) * size * 0.36)
		r1.Parent = bell
		local b = Instance.new("Beam")
		b.Attachment0 = r0
		b.Attachment1 = r1
		b.FaceCamera = true
		b.Width0 = size * 0.08
		b.Width1 = size * 0.02
		b.Segments = 10
		b.Color = ColorSequence.new(col:Lerp(Color3.new(1, 1, 1), 0.3), col)
		b.Transparency = NumberSequence.new({
			NumberSequenceKeypoint.new(0, 0.25),
			NumberSequenceKeypoint.new(1, 0.9),
		})
		b.LightEmission = 0.8
		b.LightInfluence = 0.2
		b.Parent = bell
		roots[k] = r0
		tips[k] = { att = r1, base = r1.Position, ph = a }
		beams[k] = b
	end

	local light = Instance.new("PointLight")
	light.Color = col
	light.Range = 16
	light.Brightness = 1.3
	light.Shadows = false
	light.Enabled = false
	light.Parent = core

	model.Parent = parent
	return {
		model = model,
		bell = bell,
		rim = rim,
		core = core,
		mesh = mesh,
		rimMesh = rimMesh,
		tips = tips,
		beams = beams,
		light = light,
		squash = { x = 0, v = 0 }, -- пружина прыжка
		size = size,
	}
end

return JellyBuilder
]==])

put("ReplicatedStorage/Archipelago/Assets/WhaleBuilder", "ModuleScript", [==[
--!nonstrict
-- WhaleBuilder — небесный кит кодом (только клиент): мягкое тело из эллипсоидов, светлое брюхо,
-- светящиеся полосы и точки на спине (ночью ярче), глаза с румянцем, плавники и хвост для анимации,
-- невидимая площадка на спине (на ней стоят и едут игроки), у «Старого кита» — сад со страницей летописи.
-- Возвращает «скелет»: части привязаны к кускам тела (base = номер куска) или к площадке (base = "back").

local WhaleBuilder = {}

local SEG_PROFILE = { 0.118, 0.152, 0.162, 0.156, 0.132, 0.094, 0.052 }

local function ellipsoid(size: Vector3, color: Color3, material: Enum.Material?, parent: Instance): Part
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = false
	p.Size = size
	p.Color = color
	p.Material = material or Enum.Material.SmoothPlastic
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	local m = Instance.new("SpecialMesh")
	m.MeshType = Enum.MeshType.Sphere
	m.Parent = p
	p.Parent = parent
	return p
end

local function block(size: Vector3, color: Color3, material: Enum.Material?, parent: Instance): Part
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = false
	p.Size = size
	p.Color = color
	p.Material = material or Enum.Material.SmoothPlastic
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = parent
	return p
end

-- w — запись из Movers/Whales.list
function WhaleBuilder.build(w, parent: Instance)
	local def = w.def
	local L = w.size
	local SEG = #SEG_PROFILE
	local model = Instance.new("Model")
	model.Name = "Whale_" .. def.id

	local rig = {
		model = model,
		entries = {},
		stripes = {},
		d = {},
		amp = {},
		seg = SEG,
	}

	local function add(part: BasePart, base, offset: CFrame, extra)
		local e = { part = part, base = base, offset = offset }
		if extra then
			for k, v in pairs(extra) do
				e[k] = v
			end
		end
		table.insert(rig.entries, e)
		return e
	end

	local span = 0.86 * L
	local segLen = span / (SEG - 1)
	local mid = (SEG + 1) / 2
	for i = 1, SEG do
		rig.d[i] = L * 0.06 + span * (i - 1) / (SEG - 1)
		-- волна: голова и хвост ходят, середина спокойна (на ней стоят)
		rig.amp[i] = (math.abs(i - mid) / (mid - 1)) ^ 1.3
	end

	local body = def.body
	local belly = def.belly
	local glow = def.glow

	for i = 1, SEG do
		local r = L * SEG_PROFILE[i]
		local len = segLen * ((i == 1) and 1.9 or 1.75)
		local part = ellipsoid(Vector3.new(2 * r, 2 * r * 0.82, len), body, nil, model)
		part.Name = "Body" .. i
		add(part, i, CFrame.new())
		local b = ellipsoid(Vector3.new(2 * r * 0.88, 2 * r * 0.58, len * 0.95), belly, nil, model)
		b.Name = "Belly" .. i
		add(b, i, CFrame.new(0, -r * 0.34, 0))

		-- светящиеся полосы по бокам (кусок 2..5) и точки по хребту
		if i >= 2 and i <= SEG - 2 then
			for _, sx in ipairs({ -1, 1 }) do
				local st = ellipsoid(Vector3.new(0.7, r * 0.2, len * 0.78), glow, Enum.Material.Neon, model)
				st.Name = "Stripe"
				add(st, i, CFrame.new(sx * r * 0.93, r * 0.12, 0))
				table.insert(rig.stripes, st)
			end
			local dot = ellipsoid(Vector3.new(r * 0.16, r * 0.16, r * 0.16), glow, Enum.Material.Neon, model)
			dot.Name = "Dot"
			add(dot, i, CFrame.new(0, r * 0.8, 0))
			table.insert(rig.stripes, dot)
		end

		if i == 1 then
			rig.head = part
			-- морда
			local snout = ellipsoid(Vector3.new(2 * r * 0.92, 2 * r * 0.72, r * 1.7), body, nil, model)
			snout.Name = "Snout"
			add(snout, 1, CFrame.new(0, -r * 0.06, -segLen * 0.72))
			local chin = ellipsoid(Vector3.new(2 * r * 0.8, 2 * r * 0.46, r * 1.55), belly, nil, model)
			chin.Name = "Chin"
			add(chin, 1, CFrame.new(0, -r * 0.36, -segLen * 0.66))
			-- глаза, блики, румянец
			for _, sx in ipairs({ -1, 1 }) do
				local eye = ellipsoid(Vector3.new(r * 0.34, r * 0.34, r * 0.34), Color3.fromRGB(250, 250, 255), nil, model)
				eye.Name = "Eye"
				add(eye, 1, CFrame.new(sx * r * 0.8, r * 0.06, -segLen * 0.42))
				local pupil = ellipsoid(Vector3.new(r * 0.2, r * 0.22, r * 0.2), Color3.fromRGB(28, 26, 48), nil, model)
				pupil.Name = "Pupil"
				add(pupil, 1, CFrame.new(sx * r * 0.92, r * 0.06, -segLen * 0.47))
				local shine = ellipsoid(Vector3.new(r * 0.07, r * 0.07, r * 0.07), Color3.new(1, 1, 1), Enum.Material.Neon, model)
				shine.Name = "Shine"
				add(shine, 1, CFrame.new(sx * r * 0.99, r * 0.12, -segLen * 0.5))
				local blush = ellipsoid(Vector3.new(r * 0.08, r * 0.18, r * 0.32), Color3.fromRGB(255, 150, 190), Enum.Material.Neon, model)
				blush.Name = "Blush"
				blush.Transparency = 0.35
				add(blush, 1, CFrame.new(sx * r * 0.86, -r * 0.2, -segLen * 0.22))
			end
		end

		-- грудные плавники
		if i == 2 then
			for _, sx in ipairs({ -1, 1 }) do
				local fin = ellipsoid(Vector3.new(r * 1.6, 1.1, r * 0.85), body, nil, model)
				fin.Name = "Fin"
				local tip = ellipsoid(Vector3.new(r * 0.5, 1.2, r * 0.42), glow, Enum.Material.Neon, model)
				tip.Name = "FinTip"
				tip.Transparency = 0.2
				local hinge = CFrame.new(sx * r * 0.82, -r * 0.3, 0)
				add(fin, i, hinge, { anim = "fin", sign = sx, loc = CFrame.new(sx * r * 0.78, -r * 0.08, 0) })
				add(tip, i, hinge, { anim = "fin", sign = sx, loc = CFrame.new(sx * r * 1.5, -r * 0.12, r * 0.1) })
				table.insert(rig.stripes, tip)
			end
		end

		-- хвост
		if i == SEG then
			local hinge = CFrame.new(0, 0, segLen * 0.62)
			for _, sx in ipairs({ -1, 1 }) do
				local fluke = ellipsoid(Vector3.new(L * 0.17, 1.2, L * 0.075), body, nil, model)
				fluke.Name = "Fluke"
				add(fluke, i, hinge, {
					anim = "fluke",
					loc = CFrame.new(sx * L * 0.075, 0, L * 0.035) * CFrame.Angles(0, sx * 0.38, 0),
				})
				local edge = ellipsoid(Vector3.new(L * 0.12, 1.3, L * 0.03), glow, Enum.Material.Neon, model)
				edge.Name = "FlukeGlow"
				edge.Transparency = 0.25
				add(edge, i, hinge, {
					anim = "fluke",
					loc = CFrame.new(sx * L * 0.09, 0, L * 0.06) * CFrame.Angles(0, sx * 0.38, 0),
				})
				table.insert(rig.stripes, edge)
			end
		end
	end

	-- площадка на спине (невидимая, твёрдая): на ней стоят и едут
	local rMid = L * SEG_PROFILE[3]
	local platform = block(Vector3.new(rMid * 1.25, 1, L * 0.42), Color3.new(1, 1, 1), nil, model)
	platform.Name = "Back"
	platform.Transparency = 1
	platform.CanCollide = true
	platform.CanQuery = true
	platform:SetAttribute("WhaleRide", def.id)
	add(platform, "back", CFrame.new())
	rig.platform = platform
	rig.rideParts = { platform }
	platform.Size = Vector3.new(rMid * 0.9, 1, L * 0.42)
	-- боковые скаты по изгибу спины (~32°) — тоже твёрдые, на них тоже едут
	for _, sx in ipairs({ -1, 1 }) do
		local side = block(Vector3.new(rMid * 0.36, 1, L * 0.42), Color3.new(1, 1, 1), nil, model)
		side.Name = "BackSide"
		side.Transparency = 1
		side.CanCollide = true
		side.CanQuery = true
		add(side, "back", CFrame.new(sx * rMid * 0.6, -rMid * 0.135, 0) * CFrame.Angles(0, 0, -sx * 0.56))
		table.insert(rig.rideParts, side)
	end
	-- невидимые бортики: не сойти с края спины (перепрыгнуть можно — 3.5 стад)
	local rails = {
		{ Vector3.new(0.5, 3.5, L * 0.42), CFrame.new(rMid * 0.76, -rMid * 0.25 + 1.75, 0) },
		{ Vector3.new(0.5, 3.5, L * 0.42), CFrame.new(-rMid * 0.76, -rMid * 0.25 + 1.75, 0) },
		{ Vector3.new(rMid * 1.5, 3.5, 0.5), CFrame.new(0, 1.75, L * 0.21) },
		{ Vector3.new(rMid * 1.5, 3.5, 0.5), CFrame.new(0, 1.75, -L * 0.21) },
	}
	for _, rl in ipairs(rails) do
		local rail = block(rl[1], Color3.new(1, 1, 1), nil, model)
		rail.Name = "BackRail"
		rail.Transparency = 1
		rail.CanCollide = true
		add(rail, "back", rl[2])
	end

	-- сад на спине «Старого кита»
	if def.garden then
		local grass = Color3.fromRGB(122, 200, 120)
		local mound = ellipsoid(Vector3.new(rMid * 1.3, 4, L * 0.36), grass, Enum.Material.Grass, model)
		mound.Name = "Garden"
		add(mound, "back", CFrame.new(0, -0.4, 0))
		local trees = {
			{ CFrame.new(-rMid * 0.32, 0, 7), Color3.fromRGB(255, 176, 214) },
			{ CFrame.new(rMid * 0.3, 0, 12), Color3.fromRGB(150, 230, 160) },
			{ CFrame.new(rMid * 0.18, 0, -2), Color3.fromRGB(255, 214, 140) },
		}
		for _, tr in ipairs(trees) do
			local trunk = block(Vector3.new(1.1, 6, 1.1), Color3.fromRGB(120, 86, 70), Enum.Material.Wood, model)
			trunk.Name = "Trunk"
			add(trunk, "back", tr[1] * CFrame.new(0, 3.4, 0))
			local crown = ellipsoid(Vector3.new(7, 6, 7), tr[2], nil, model)
			crown.Name = "Crown"
			add(crown, "back", tr[1] * CFrame.new(0, 7.6, 0))
			local crown2 = ellipsoid(Vector3.new(4.5, 4, 4.5), tr[2]:Lerp(Color3.new(1, 1, 1), 0.25), nil, model)
			crown2.Name = "Crown"
			add(crown2, "back", tr[1] * CFrame.new(1.4, 9.4, -0.8))
		end
		-- цветы-огоньки
		local rnd = Random.new(7)
		local fcol = { Color3.fromRGB(255, 120, 180), Color3.fromRGB(255, 236, 120), Color3.fromRGB(140, 220, 255) }
		for k = 1, 12 do
			local f = ellipsoid(Vector3.new(0.7, 0.7, 0.7), fcol[(k - 1) % #fcol + 1], Enum.Material.Neon, model)
			f.Name = "Flower"
			add(f, "back", CFrame.new(rnd:NextNumber(-rMid * 0.5, rMid * 0.5), 1.7, rnd:NextNumber(-L * 0.15, L * 0.15)))
		end
		-- фонарик
		local lamp = block(Vector3.new(1.2, 1.6, 1.2), Color3.fromRGB(255, 214, 150), Enum.Material.Neon, model)
		lamp.Name = "Lamp"
		add(lamp, "back", CFrame.new(rMid * 0.35, 2.4, -4))
		local pl = Instance.new("PointLight")
		pl.Color = Color3.fromRGB(255, 200, 140)
		pl.Range = 18
		pl.Brightness = 1.4
		pl.Parent = lamp
		-- страница летописи
		local page = block(Vector3.new(1.8, 0.12, 2.4), Color3.fromRGB(255, 248, 228), Enum.Material.SmoothPlastic, model)
		page.Name = "LorePage"
		local pageEntry = add(page, "back", CFrame.new(0, 3.2, -9), { anim = "page" })
		local halo = Instance.new("Part")
		halo.Anchored = true
		halo.CanCollide = false
		halo.CanQuery = false
		halo.CanTouch = false
		halo.CastShadow = false
		halo.Shape = Enum.PartType.Cylinder
		halo.Size = Vector3.new(0.2, 4.2, 4.2)
		halo.Material = Enum.Material.Neon
		halo.Color = Color3.fromRGB(255, 226, 150)
		halo.Transparency = 0.45
		halo.Parent = model
		add(halo, "back", CFrame.new(0, 1.9, -9) * CFrame.Angles(0, 0, math.rad(90)))
		local sp = Instance.new("ParticleEmitter")
		sp.Texture = "rbxasset://textures/particles/sparkles_main.dds"
		sp.Color = ColorSequence.new(Color3.fromRGB(255, 230, 160))
		sp.LightEmission = 1
		sp.Size = NumberSequence.new(0.35, 0)
		sp.Lifetime = NumberRange.new(1, 1.8)
		sp.Speed = NumberRange.new(1, 3)
		sp.Rate = 8
		sp.SpreadAngle = Vector2.new(180, 180)
		sp.Parent = page
		rig.page = page
		rig.pageEntry = pageEntry
		rig.pageHalo = halo
	end

	model.Parent = parent
	return rig
end

return WhaleBuilder
]==])

put("ReplicatedStorage/Archipelago/Config/Ambience", "ModuleScript", [==[
--!nonstrict
-- Config.Ambience — все звуки этапа 4. 0 = звука нет: «найти в Studio» (Creator Store), найденный ID
-- сразу дописать в скилл «Нимбов». Проверенные ID — те же, что в Config.Flight.SND.

return {
	-- проверенные (из Config.Flight.SND)
	OK = {
		WIND_LOOP = 5113213873,
		WHISTLE_LOOP = 687874741,
		HUM_LOOP = 9112795571,
		WHOOSH = { 90661028523798, 9125647212, 9125646712 },
		CHIME = { 9116394545, 9116395089 },
		CHOIR = 121538758381608,
		FLAP = { 9120778367, 9120779671 },
		BOOM = 1835337001, -- boom
		BOOM_B = 9039916716, -- boomB
		FALL = { 9113475819, 9113473249 },
	},

	-- киты
	WHALE_SONG = 0, -- найти в Studio: низкая протяжная песня кита
	-- пока песни нет — гул-петля, очень низко (временно)
	WHALE_SONG_FALLBACK = { id = 9112795571, speed = 0.3, volume = 1.4 },

	-- медузы
	JELLY_BOUNCE = 0, -- найти в Studio: «бульк-звон»
	JELLY_FALLBACK = { { id = 9116394545, speed = 1.45, volume = 0.6 }, { id = 9120779671, speed = 1.8, volume = 0.35 } },

	-- погода
	THUNDER = 0, -- найти в Studio: раскат грома
	-- временно: boom + boomB с понижением
	THUNDER_FALLBACK = { { id = 1835337001, speed = 0.55, volume = 1.3 }, { id = 9039916716, speed = 0.7, volume = 1.0 } },
	CRACKLE = 0, -- найти в Studio: треск перед ударом молнии
	RAIN_LOOP = 0, -- найти в Studio: дождь-петля
	BLIZZARD_LOOP = 0, -- найти в Studio: метель-петля
	STORM_WIND_FALLBACK = { id = 687874741, speed = 0.72, volume = 0.55 }, -- пока нет дождя/метели

	-- птицы
	BIRDS_CHIRP = 0, -- найти в Studio: щебет-искорки
	BIRDS_SCATTER = { id = 9116395089, speed = 1.6, volume = 0.5 }, -- разлёт: звон

	-- регионы: фоновые петли (день / ночь). Переход 3 с (Config.Sky.REGION_FADE).
	REGIONS = {
		nest = { day = 0, night = 0, volume = 0.45 }, -- найти: тёплый ветер, далёкие колокольчики
		meadow = { day = 0, night = 0, volume = 0.5 }, -- найти: ветер в траве + колокольчики / сверчки ночью
		temple = { day = 0, night = 0, volume = 0.5 }, -- найти: эхо, хор вдалеке
		forge = { day = 0, night = 0, volume = 0.55 }, -- найти: гул горна, удары молота вдалеке
		ice = { day = 0, night = 0, volume = 0.55 }, -- найти: треск льда, вой ветра
		roots = { day = 0, night = 0, volume = 0.5 }, -- найти: шелест, скрип дерева
	},
	REGION_FADE = 3,

	-- ветер по высоте (проверенные петли): чем выше — тем громче
	WIND = {
		BASE_Y = -200, -- ниже этого (от ORIGIN.Y) ветер тихий
		TOP_Y = 1600, -- здесь ветер на максимуме
		VOLUME = { 0.12, 0.7 },
		PITCH = { 0.85, 1.15 },
		WHISTLE_SPEED = 90, -- с этой скорости (стад/с) слышен свист
		WHISTLE_VOLUME = 0.45,
	},

	-- под облачным морем всё глухо
	UNDERSEA = {
		SEA_Y = -500,
		HUM_VOLUME = 0.5,
		EQ = { High = -28, Mid = -10, Low = 2 },
	},

	-- звуковые зоны по тегу ArchAmbientZone: включаются ближе Radius × ZONE_REACH
	ZONE_REACH = 1.4,
	ZONE_MAX = 6,
}
]==])

put("ReplicatedStorage/Archipelago/Config/Guardian", "ModuleScript", [==[
--!nonstrict
-- Config.Guardian — Страж Храма (этап 4). Урон — только через ServerStorage.HaloHooks.damage.
-- Каждую атаку видно заранее: замах (телеграф на земле) → удар → восстановление.

local C3 = Color3.fromRGB

return {
	ENABLED = true,
	NAME = "Страж Храма",
	SUBTITLE = "хранитель треснувшего нимба",

	-- арена: деталь с тегом ArchGuardianArena (верх = пол). Если её нет — запасная платформа здесь
	-- (смещение от ORIGIN; Храм: восток +X, высота +300…+700). TODO(studio): поставить на Верхнюю террасу Храма.
	ARENA_TAG = "ArchGuardianArena",
	ARENA_FALLBACK = Vector3.new(4700, 560, 260),
	ARENA_RADIUS = 95,
	BUILD_FALLBACK_ARENA = true,

	WAKE_RADIUS = 105, -- первый игрок ближе — Страж просыпается
	LEASH = 170, -- бойцы — игроки ближе этого (по горизонтали) и не выше LEASH_UP над полом
	LEASH_UP = 120,
	RESET_EMPTY = 30, -- с без бойцов → сброс здоровья и фазы
	RESPAWN = 600, -- с после победы (10 минут)
	MET_DELAY = 6, -- с в радиусе пробуждения → «встретил» (больше не показываем сцену)

	HEALTH = { BASE = 3200, PER_EXTRA = 1800, MAX_FIGHTERS = 4 }, -- TODO(studio): подогнать под урон способностей
	PHASES = { 1.0, 0.66, 0.33 }, -- доля здоровья, с которой начинается фаза
	PHASE_NAMES = { "Камень", "Свет", "Гнев" },
	TRANSITION = 3.6, -- с неуязвимости между фазами (рёв, нимб трескается сильнее)
	INTRO = 4.6, -- с пробуждения (неуязвим)
	TURN_SPEED = 95, -- град/с поворота к цели
	FIGHT_MIN = 20, -- с в бою, чтобы получить награду за победу

	-- пауза между атаками {от, до} по фазам
	GAP = { { 1.7, 2.5 }, { 1.35, 2.05 }, { 1.0, 1.6 } },

	-- атаки. weight — вес в фазах {1, 2, 3}; windup — замах (телеграф), recover — восстановление
	ATTACKS = {
		slam = { -- кулак в точку под целью
			weight = { 3, 2, 2 },
			windup = 1.15,
			recover = 0.9,
			range = 75, -- цель не дальше от Стража
			radius = 15, -- прямой удар
			damage = 26,
			ring = 30, -- волна вокруг
			ringDamage = 10,
			knock = 70,
		},
		sweep = { -- взмах рукой по дуге перед собой (только если цель близко)
			weight = { 2, 2, 1 },
			windup = 0.85,
			recover = 0.8,
			close = 28, -- цель ближе — можно
			radius = 26,
			arc = 150, -- градусов
			damage = 20,
			knock = 90,
		},
		quake = { -- оба кулака в пол: расходится кольцо, через него надо перепрыгнуть
			weight = { 1, 2, 2 },
			windup = 1.3,
			recover = 0.9,
			speed = 46, -- стад/с
			maxR = 92,
			duration = 2.11, -- (maxR + width) / speed: кольцо успевает дойти до края, атака не кончается раньше
			width = 5,
			height = 4.5, -- выше над полом — волна не задевает
			damage = 22,
			knock = 60,
		},
		beams = { -- лучи из нимба крутятся вокруг: прыгнуть или стоять в просвете
			weight = { 0, 3, 2 },
			windup = 1.45,
			duration = 6.5,
			recover = 1.0,
			count = { 0, 3, 4 }, -- по фазам
			turn = 40, -- град/с
			length = 92,
			height = 3.4, -- центр луча над полом
			thick = 3.2,
			tick = 0.3,
			damage = 9,
		},
		rubble = { -- камнепад: круги под ногами, камни падают с неба
			weight = { 0, 0, 3 },
			windup = 1.5,
			recover = 0.9,
			perFighter = 2,
			extra = 3,
			spread = 7, -- насколько круги смещены от игрока (заставляют двигаться)
			radius = 9,
			damage = 28,
			linger = 5, -- с камни лежат, потом рассыпаются
		},
	},

	-- награда за первую победу (переходник Stage4Progress)
	REWARD = {
		shard = "temple_shard_guardian", -- TODO(studio): сверить с Manifest.Temple
		lore = "temple_lore_guardian",
		cosmetic = "stoneheart", -- новый id косметики: «Каменное сердце» — частицы камня в нимбе
	},

	-- вид
	LOOK = {
		HEIGHT = 28,
		STONE = C3(233, 228, 216),
		STONE_DARK = C3(176, 168, 156),
		MOSS = C3(120, 168, 120),
		GLOW = C3(64, 245, 224), -- бирюзовый свет
		ANGRY = C3(255, 120, 72), -- фаза «Гнев»
		DANGER = C3(255, 82, 60), -- телеграфы
		DANGER_SOFT = C3(255, 170, 80),
		BEAM = C3(140, 255, 240),
	},

	-- звуки: 0 = найти в Studio. Пока нет — временные из проверенных (Config.Ambience.OK)
	SND = {
		ROAR = 0, -- найти: каменный рёв
		SLAM = 0, -- найти: удар камня о камень
		SWEEP = 0, -- найти: тяжёлый взмах
		QUAKE = 0, -- найти: землетрясение
		BEAM_LOOP = 0, -- найти: гудение луча
		RUBBLE = 0, -- найти: свист падающего камня
		CRUMBLE = 0, -- найти: обвал
		WAKE = 0, -- найти: пробуждение (скрежет + хор)
		HALO_CRACK = 0, -- найти: треск стекла/света
	},
}
]==])

put("ReplicatedStorage/Archipelago/Config/Life", "ModuleScript", [==[
--!nonstrict
-- Config.Life — киты, медузы, птицы (этап 4). Базовые числа — в Config.Creatures:
-- WHALE {COUNT, LENGTH, SPEED, LOOP_LENGTH, SONG_RANGE}, JELLY {GROUP, BOUNCE, LIGHT}, BIRDS {GROUP}.
-- Координаты — смещения от World.ORIGIN, север = +Z. TODO(studio): подвинуть под настоящие острова на этапе 5.

local V = Vector3.new
local C3 = Color3.fromRGB

return {
	-- три кита, у каждого своё кольцо (длина кольца должна попасть в Creatures.WHALE.LOOP_LENGTH)
	WHALES = {
		{
			id = "meadow",
			name = "Луговой кит",
			speed = 30, -- стад/с (в пределах Creatures.WHALE.SPEED)
			phase = 0.0, -- сдвиг по кругу 0–1, чтобы киты не шли рядом
			scale = 1.0,
			body = C3(76, 98, 182),
			belly = C3(200, 216, 255),
			glow = C3(120, 255, 226),
			-- юг: проходит рядом с главной дорогой «хаб → Луг» (первые минуты новичка)
			route = {
				V(260, 70, -880),
				V(1250, 130, -1650),
				V(1700, 40, -3050),
				V(1050, -40, -4300),
				V(-450, 10, -4750),
				V(-1550, 90, -3700),
				V(-1450, 150, -2250),
				V(-650, 110, -1150),
			},
		},
		{
			id = "high",
			name = "Высокий кит",
			speed = 33,
			phase = 0.37,
			scale = 0.92,
			body = C3(104, 82, 186),
			belly = C3(226, 206, 255),
			glow = C3(255, 150, 236),
			-- восток и север: над Храмом и под Ледяным венцом
			route = {
				V(2130, 460, 1250),
				V(3650, 600, 1780),
				V(4640, 780, 3030),
				V(4100, 1060, 4480),
				V(2660, 1120, 5010),
				V(1480, 820, 3950),
				V(1290, 560, 2500),
			},
		},
		{
			id = "old",
			name = "Старый кит",
			speed = 26,
			phase = 0.71,
			scale = 1.12,
			body = C3(58, 82, 128),
			belly = C3(178, 202, 236),
			glow = C3(255, 214, 120),
			garden = true, -- на спине сад и страница летописи (секрет)
			-- запад и северо-запад, низко над облачным морем: снизу видна тень
			route = {
				V(-2320, -390, 290),
				V(-3410, -430, 800),
				V(-4630, -410, 1690),
				V(-4430, -370, 3080),
				V(-3410, -320, 3690),
				V(-2350, -340, 2810),
				V(-1950, -370, 1480),
			},
		},
	},

	WHALE = {
		SEGMENTS = 7, -- кусков тела (голова — первый)
		WAVE_AMP = 3.4, -- волна по телу, стад
		WAVE_SPEED = 1.15, -- рад/с
		WAVE_K = 0.6, -- сдвиг волны между кусками
		BANK = 0.38, -- максимальный крен в повороте, рад
		BANK_GAIN = 900, -- крен = поворот (рад/стад) × это
		LOD = { 1800, 4500 }, -- ближе первого — каждый кадр; дальше — реже; за вторым — раз в 0.25 с
		HIDE = 9000, -- дальше — не рисовать
		SONG_EVERY = { 26, 44 }, -- с между песнями (одинаково у всех: от времени сервера)
		SONG_LEN = 7.5,
		RIDE_RAY = 9, -- луч вниз от персонажа, чтобы понять, что он стоит на ките
		STRIPE_DAY = 0.82, -- прозрачность светящихся полос днём (ночью → 0.05)
	},

	-- секрет на спине «Старого кита»
	WHALE_SECRET = {
		whale = "old",
		secret = "secret_whale", -- TODO(studio): сверить формат id с Manifest (latin, как meadow_shard_01)
		lore = "whale_lore_01",
		radius = 14, -- сервер: игрок не дальше от страницы
	},

	-- стайки медуз (count — в пределах Creatures.JELLY.GROUP)
	JELLY_GROUPS = {
		{ id = "meadow_a", region = "meadow", center = V(650, 40, -2500), radius = 75, count = 8 },
		{ id = "meadow_b", region = "meadow", center = V(-900, 120, -3900), radius = 90, count = 10 },
		{ id = "roots_a", region = "roots", center = V(-2900, 260, 2900), radius = 80, count = 9 },
		{ id = "roots_b", region = "roots", center = V(-3500, -380, 3500), radius = 70, count = 7 },
		{ id = "depths_a", region = "depths", center = V(-2400, -820, 2200), radius = 110, count = 12 },
	},

	JELLY = {
		SIZE = { 6, 9 }, -- диаметр колокола
		DRIFT = 9, -- плавное блуждание, стад
		BOB = 4.5, -- покачивание вверх-вниз
		COLORS = { C3(120, 230, 255), C3(255, 150, 220), C3(180, 150, 255), C3(140, 255, 200) },
		NEAR = 420, -- ближе — анимация и проверка прыжка
		LIGHT_NEAR = 160, -- ближе — PointLight
		COOLDOWN = 8, -- с, одна медуза даёт свет одному игроку не чаще
		LOCAL_COOLDOWN = 0.25, -- с, повторный подброс от той же медузы (меньше времени полёта — можно прыгать подряд)
		CHECK_RADIUS = 24, -- сервер: игрок не дальше от медузы (с запасом на пинг)
		RATE = 0.4, -- с, не чаще на игрока
	},

	BIRDS = {
		RANGE = 900, -- стайки вокруг островов ближе этого
		MAX_FLOCKS = 4,
		ORBIT = { 45, 90 }, -- радиус круга над островом
		HEIGHT = { 18, 60 }, -- над верхом острова
		SPEED = { 0.25, 0.45 }, -- рад/с по кругу
		SCATTER_RADIUS = 22, -- пролёт ближе — стайка разлетается
		SCATTER_TIME = 2.6, -- с до сбора
		COLORS = { C3(255, 236, 150), C3(150, 240, 255), C3(255, 170, 220) },
		TRAIL_EVERY = 3, -- след у каждой третьей
		-- если островов рядом нет (этап 5 ещё не построил) — стайки висят у этих мест
		FALLBACK = { V(0, 90, -760), V(700, 120, 300), V(-650, 100, 450) },
	},
}
]==])

put("ReplicatedStorage/Archipelago/Config/Night", "ModuleScript", [==[
--!nonstrict
-- Config.Night — сутки и ночь (этап 4). Длины фаз — в Config.Day.PHASES (не дублировать).
-- Свет суток идёт слоем "daynight" через LightingDirector (NightClient). Lighting.ClockTime напрямую не писать.

local C3 = Color3.fromRGB

return {
	-- с какой фазы начинаются сутки при запуске сервера (проверка «за 24 минуты — полные сутки»)
	START_PHASE = "day",

	-- часы Roblox для каждой фазы: {начало, конец}; конец может быть > 24 (ночь переходит через полночь)
	CLOCK = {
		dawn = { 5.0, 7.0 },
		day = { 7.0, 17.0 },
		sunset = { 17.0, 19.0 },
		night = { 19.0, 28.5 },
		predawn = { 4.5, 5.0 },
	},

	-- как часто слой daynight обновляет свет (с); ClockTime смешивается директором по кругу
	TICK = 1 / 15,

	-- ключевые кадры света по часам (между ними — плавно). Только слой daynight.
	-- Grade.TintColor НЕ писать: он отдан вспышкам WorldFX (слой fx).
	KEYS = {
		{ 0.0, {
			["Lighting.Brightness"] = 0.9,
			["Lighting.Ambient"] = C3(34, 34, 62),
			["Lighting.OutdoorAmbient"] = C3(58, 62, 112),
			["Lighting.ColorShift_Top"] = C3(110, 130, 220),
			["Lighting.ExposureCompensation"] = 0.15,
			["Atmosphere.Color"] = C3(62, 72, 130),
			["Atmosphere.Decay"] = C3(28, 26, 64),
			["Atmosphere.Density"] = 0.34,
			["Atmosphere.Haze"] = 1.4,
			["Atmosphere.Glare"] = 0,
			["Bloom.Intensity"] = 1.1,
			["SunRays.Intensity"] = 0,
		} },
		{ 5.2, {
			["Lighting.Brightness"] = 1.2,
			["Lighting.Ambient"] = C3(60, 48, 78),
			["Lighting.OutdoorAmbient"] = C3(118, 92, 132),
			["Lighting.ColorShift_Top"] = C3(200, 140, 180),
			["Lighting.ExposureCompensation"] = 0.1,
			["Atmosphere.Color"] = C3(170, 120, 170),
			["Atmosphere.Decay"] = C3(80, 60, 120),
			["Atmosphere.Density"] = 0.36,
			["Atmosphere.Haze"] = 2.0,
			["Atmosphere.Glare"] = 0.3,
			["Bloom.Intensity"] = 0.9,
			["SunRays.Intensity"] = 0.05,
		} },
		{ 6.3, {
			["Lighting.Brightness"] = 2.0,
			["Lighting.Ambient"] = C3(96, 80, 90),
			["Lighting.OutdoorAmbient"] = C3(170, 130, 130),
			["Lighting.ColorShift_Top"] = C3(255, 178, 130),
			["Lighting.ExposureCompensation"] = 0.05,
			["Atmosphere.Color"] = C3(255, 178, 150),
			["Atmosphere.Decay"] = C3(150, 96, 130),
			["Atmosphere.Density"] = 0.34,
			["Atmosphere.Haze"] = 2.4,
			["Atmosphere.Glare"] = 0.9,
			["Bloom.Intensity"] = 0.75,
			["SunRays.Intensity"] = 0.18,
		} },
		{ 8.5, {
			["Lighting.Brightness"] = 2.8,
			["Lighting.Ambient"] = C3(112, 112, 128),
			["Lighting.OutdoorAmbient"] = C3(146, 146, 158),
			["Lighting.ColorShift_Top"] = C3(255, 244, 226),
			["Lighting.ExposureCompensation"] = 0,
			["Atmosphere.Color"] = C3(196, 220, 255),
			["Atmosphere.Decay"] = C3(104, 134, 186),
			["Atmosphere.Density"] = 0.3,
			["Atmosphere.Haze"] = 1.1,
			["Atmosphere.Glare"] = 0.25,
			["Bloom.Intensity"] = 0.6,
			["SunRays.Intensity"] = 0.1,
		} },
		{ 15.6, {
			["Lighting.Brightness"] = 2.7,
			["Lighting.Ambient"] = C3(116, 110, 122),
			["Lighting.OutdoorAmbient"] = C3(150, 142, 150),
			["Lighting.ColorShift_Top"] = C3(255, 236, 210),
			["Lighting.ExposureCompensation"] = 0,
			["Atmosphere.Color"] = C3(206, 218, 250),
			["Atmosphere.Decay"] = C3(112, 130, 180),
			["Atmosphere.Density"] = 0.3,
			["Atmosphere.Haze"] = 1.2,
			["Atmosphere.Glare"] = 0.3,
			["Bloom.Intensity"] = 0.62,
			["SunRays.Intensity"] = 0.12,
		} },
		{ 17.9, {
			["Lighting.Brightness"] = 2.1,
			["Lighting.Ambient"] = C3(108, 78, 92),
			["Lighting.OutdoorAmbient"] = C3(178, 118, 120),
			["Lighting.ColorShift_Top"] = C3(255, 136, 84),
			["Lighting.ExposureCompensation"] = 0.05,
			["Atmosphere.Color"] = C3(255, 150, 118),
			["Atmosphere.Decay"] = C3(150, 64, 120),
			["Atmosphere.Density"] = 0.35,
			["Atmosphere.Haze"] = 2.7,
			["Atmosphere.Glare"] = 1.4,
			["Bloom.Intensity"] = 0.85,
			["SunRays.Intensity"] = 0.24,
		} },
		{ 19.4, {
			["Lighting.Brightness"] = 1.1,
			["Lighting.Ambient"] = C3(52, 42, 84),
			["Lighting.OutdoorAmbient"] = C3(82, 70, 130),
			["Lighting.ColorShift_Top"] = C3(150, 110, 220),
			["Lighting.ExposureCompensation"] = 0.12,
			["Atmosphere.Color"] = C3(110, 86, 160),
			["Atmosphere.Decay"] = C3(50, 34, 90),
			["Atmosphere.Density"] = 0.35,
			["Atmosphere.Haze"] = 1.8,
			["Atmosphere.Glare"] = 0.2,
			["Bloom.Intensity"] = 1.0,
			["SunRays.Intensity"] = 0.02,
		} },
	},

	-- светлячки (ночь): над островами этих регионов + детали с тегом ArchFireflies
	FIREFLIES = {
		REGIONS = { meadow = true, roots = true },
		RANGE = 700, -- дальше от камеры не горят
		MAX_ISLANDS = 6,
		RATE = 9, -- в секунду на остров при полной ночи
		COLOR = { C3(255, 236, 120), C3(190, 255, 150) },
	},

	-- окна руин и фонари (теги ArchNightGlow / ArchNightLight)
	GLOW = {
		DEFAULT = C3(255, 196, 120),
		ON_AT = 0.45, -- ночной коэффициент, с которого окна переключаются в Neon
	},

	-- созвездия-подсказки к финалу: направление на небе (азимут, высота в градусах) и звёзды (x, y в «ячейках» 0..10)
	-- линии — пары номеров звёзд. Видны ночью, ярче на высоте.
	SKY = {
		DIST = 1600, -- как далеко висят (BillboardGui, на туман не влияет)
		SIZE = 520, -- размер созвездия, стад
		COLOR = C3(205, 225, 255),
		LINE = C3(150, 190, 255),
		CONSTELLATIONS = {
			{ name = "Нимб", az = 20, el = 55, stars = { { 2, 5 }, { 3.5, 7.4 }, { 6.5, 7.4 }, { 8, 5 }, { 6.5, 2.6 }, { 3.5, 2.6 } }, lines = { { 1, 2 }, { 2, 3 }, { 3, 4 }, { 4, 5 }, { 5, 6 } } },
			{ name = "Кит", az = 110, el = 38, stars = { { 1, 5 }, { 3, 6.5 }, { 5.5, 6.8 }, { 8, 5.6 }, { 9.4, 7.2 }, { 9.4, 3.8 }, { 5, 4 } }, lines = { { 1, 2 }, { 2, 3 }, { 3, 4 }, { 4, 5 }, { 4, 6 }, { 1, 7 }, { 7, 4 } } },
			{ name = "Великан", az = 200, el = 48, stars = { { 5, 9 }, { 5, 7 }, { 2.5, 6.4 }, { 7.5, 6.4 }, { 5, 4.2 }, { 3.6, 1 }, { 6.4, 1 } }, lines = { { 1, 2 }, { 2, 3 }, { 2, 4 }, { 2, 5 }, { 5, 6 }, { 5, 7 } } },
			{ name = "Ключ", az = 290, el = 32, stars = { { 1.5, 5 }, { 3, 6.4 }, { 3, 3.6 }, { 4.5, 5 }, { 9, 5 }, { 9, 3.4 }, { 7.5, 5 }, { 7.5, 3.8 } }, lines = { { 1, 2 }, { 2, 4 }, { 4, 3 }, { 3, 1 }, { 4, 5 }, { 5, 6 }, { 7, 8 } } },
			{ name = "Сердце неба", az = 0, el = 82, stars = { { 5, 2 }, { 2.4, 5 }, { 3.2, 7.4 }, { 5, 6.2 }, { 6.8, 7.4 }, { 7.6, 5 } }, lines = { { 1, 2 }, { 2, 3 }, { 3, 4 }, { 4, 5 }, { 5, 6 }, { 6, 1 } } },
		},
	},

	-- северное сияние над Ледяным венцом (север = +Z). Смещение от ORIGIN.
	AURORA = {
		CENTER = Vector3.new(0, 1850, 5600),
		SPAN = 4200, -- ширина занавеса по X
		CURTAINS = 3,
		POINTS = 9, -- точек на занавес
		HEIGHT = 420, -- высота ленты
		COLORS = { C3(80, 255, 170), C3(60, 220, 255), C3(170, 110, 255) },
		DUSK = 0.25, -- немного видно и в сумерках
	},

	-- закатный остров (тег ArchSunsetOnly): виден только в фазе sunset
	SUNSET = {
		FADE = 3.5, -- с, проявление у игрока
		HIDDEN_FOLDER = "ArchSunsetHidden",
	},
}
]==])

put("ReplicatedStorage/Archipelago/Config/WeatherCycle", "ModuleScript", [==[
--!nonstrict
-- Config.WeatherCycle — погода (этап 4). Длительности — в Config.Weather (CLEAR, CLOUDY, STORM, RAINBOW),
-- там же CURRENT_JITTER, NO_STORM_REGIONS, SNOW_REGIONS. Здесь — веса переходов, фронт, молнии, свет.

local C3 = Color3.fromRGB

return {
	-- переходы: из погоды → {в погоду = вес}. Порядок случайный, с весами.
	WEIGHTS = {
		clear = { cloudy = 1 },
		cloudy = { storm = 0.65, clear = 0.35 },
		storm = { rain = 1 },
		rain = { rainbow = 0.7, clear = 0.3 },
		rainbow = { clear = 1 },
	},
	RAIN = 1.5, -- минут «дождь стихает» после грозы

	-- после запуска сервера: короткое ясно → облачно → обязательная гроза
	-- (проверка «за 24 минуты — хотя бы одна гроза»)
	FIRST_CLEAR = 6, -- минут
	FIRST_STORM = true,

	-- фронт грозы: стена облаков идёт через часть мира по прямой
	FRONT = {
		SPEED = { 14, 22 }, -- стад/с
		WIDTH = { 2400, 3200 }, -- поперёк хода
		DEPTH = { 900, 1300 }, -- вдоль хода
		EDGE = 500, -- мягкий край силы
		TOP = 1700, -- выше (от ORIGIN.Y) гроза слабеет до нуля за 500
		RAMP_IN = 40, -- с, нарастание
		-- куда целиться (смещения от ORIGIN — примерные центры регионов; север = +Z)
		TARGETS = {
			nest = { pos = Vector3.new(0, 0, 0), w = 1 },
			meadow = { pos = Vector3.new(0, 0, -3700), w = 3 },
			temple = { pos = Vector3.new(4500, 0, 0), w = 2 },
			ice = { pos = Vector3.new(0, 0, 5200), w = 2 },
			roots = { pos = Vector3.new(-3200, 0, 3200), w = 2 },
		},
		SPREAD = 1100, -- разброс точки цели
		TRIES = 40, -- попыток найти путь мимо исключённых зон и Кузницы
		DEV_ARRIVE = 20, -- с, через сколько фронт дойдёт до игрока по команде панели `weather storm`
	},

	-- молнии
	LIGHTNING = {
		EVERY = { 1.6, 3.8 }, -- с между ударами внутри фронта
		TELEGRAPH = 0.95, -- с предупреждения (свечение в туче + треск + круг на земле)
		NEAR_FLYER = 0.45, -- доля ударов рядом с летящим игроком внутри грозы
		NEAR_DIST = { 14, 34 }, -- как близко к нему
		MIN_STORM = 0.55, -- сила грозы в точке, чтобы туда била молния
		BOLT_HEIGHT = 520, -- от точки удара до тучи
		STUN_RADIUS = 26, -- летящий ближе — крылья сложатся
		KNOCK_RADIUS = 18, -- стоящий ближе — толчок
		KNOCK = 75, -- сила толчка
		WHY = "lightning",
		SEA_Y = -500, -- если под точкой нет острова — бьёт в облачное море
	},

	-- порывы в грозе: иногда выбивают из течения (только у самого игрока)
	GUST = {
		MIN_STORM = 0.6,
		EVERY = { 7, 14 },
		CHANCE = 0.55,
		POWER = 58,
		SNOW_POWER = 72, -- в метели сильнее
	},

	-- осадки у камеры (частицы только у игрока)
	RAIN_FX = {
		RATE = 900, -- при полной силе; на слабой графике меньше
		SPEED = { 130, 160 },
		BOX = 170, -- размер коробки над камерой
		TEXTURE = "rbxasset://textures/particles/sparkles_main.dds", -- TODO(studio): найти капли/полосы
		COLOR = C3(190, 205, 235),
	},
	SNOW_FX = {
		RATE = 520,
		SPEED = { 18, 34 },
		BOX = 150,
		TEXTURE = "rbxasset://textures/particles/sparkles_main.dds", -- TODO(studio): найти снежинки
		COLOR = C3(240, 246, 255),
		WIND = 46, -- боковой снос
	},

	-- стена облаков (видна издалека)
	WALL = {
		COLS = 16,
		ROWS = { -420, -120, 200, 520, 860 }, -- высоты рядов от ORIGIN.Y
		PUFF = { 150, 290 }, -- размер облака
		COLOR = C3(62, 64, 92),
		COLOR_TOP = C3(110, 108, 140),
		FLASH = C3(196, 186, 255),
		NEAR_FADE = { 260, 520 }, -- облака ближе к камере растворяются
		SEA_FLASH = C3(170, 160, 255),
	},

	-- свет погоды (слой weather). Без Grade.TintColor (он у вспышек).
	LIGHT = {
		cloudy = {
			["Lighting.Brightness"] = 1.6,
			["Lighting.OutdoorAmbient"] = C3(126, 130, 146),
			["Atmosphere.Density"] = 0.38,
			["Atmosphere.Haze"] = 2.2,
			["Atmosphere.Glare"] = 0,
			["Atmosphere.Color"] = C3(170, 178, 196),
			["Atmosphere.Decay"] = C3(110, 118, 150),
			["Grade.Saturation"] = -0.12,
			["Grade.Contrast"] = 0.02,
			["Grade.Brightness"] = 0,
			["SunRays.Intensity"] = 0.02,
		},
		storm = {
			["Lighting.Brightness"] = 0.8,
			["Lighting.OutdoorAmbient"] = C3(70, 74, 98),
			["Atmosphere.Density"] = 0.52,
			["Atmosphere.Haze"] = 3.2,
			["Atmosphere.Glare"] = 0,
			["Atmosphere.Color"] = C3(84, 90, 116),
			["Atmosphere.Decay"] = C3(40, 40, 64),
			["Grade.Saturation"] = -0.32,
			["Grade.Contrast"] = 0.12,
			["Grade.Brightness"] = -0.04,
			["SunRays.Intensity"] = 0,
		},
		snow = {
			["Lighting.Brightness"] = 1.4,
			["Lighting.OutdoorAmbient"] = C3(170, 182, 210),
			["Atmosphere.Density"] = 0.62,
			["Atmosphere.Haze"] = 3.6,
			["Atmosphere.Glare"] = 0,
			["Atmosphere.Color"] = C3(214, 224, 244),
			["Atmosphere.Decay"] = C3(160, 176, 214),
			["Grade.Saturation"] = -0.2,
			["Grade.Contrast"] = -0.04,
			["Grade.Brightness"] = 0.05,
			["SunRays.Intensity"] = 0,
		},
		CLOUDY_WEIGHT = 0.55, -- вес слоя в облачную погоду по всему миру
		FADE = 0.6, -- с
		FLASH_BRIGHTNESS = 3.2, -- прибавка к Lighting.Brightness в момент молнии (рядом)
	},

	-- радуга после дождя (у игрока, напротив солнца)
	RAINBOW = {
		DIST = 900,
		RADIUS = 620,
		BAND = 22,
		COLORS = { C3(255, 70, 70), C3(255, 150, 60), C3(255, 230, 80), C3(90, 230, 110), C3(70, 170, 255), C3(90, 90, 230), C3(170, 90, 230) },
		ALPHA = 0.45, -- прозрачность в пике (0 — сплошная)
	},
}
]==])

put("ReplicatedStorage/Archipelago/Movers/Jellies", "ModuleScript", [==[
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
]==])

put("ReplicatedStorage/Archipelago/Movers/Route", "ModuleScript", [==[
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
]==])

put("ReplicatedStorage/Archipelago/Movers/Whales", "ModuleScript", [==[
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
	-- yawRate > 0 — поворот налево; крен внутрь поворота (левый бок ниже) — roll > 0
	local roll = math.clamp(w.route:yawRate(s) * W.BANK_GAIN, -W.BANK, W.BANK)
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
]==])

put("ReplicatedStorage/Archipelago/WorldClock", "ModuleScript", [==[
--!nonstrict
-- WorldClock — время мира и погода по атрибутам WorldState (пишет только сервер, см. CONTRACTS.md §2).
-- Одинаково считает на сервере и у игроков: сутки, фронт грозы, сила грозы в точке, дрожь течений.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Arch = ReplicatedStorage:WaitForChild("Archipelago")
local ConfigF = Arch:WaitForChild("Config")
local State = Arch:WaitForChild("WorldState")

local WorldMath = require(Arch:WaitForChild("WorldMath"))
local World = require(ConfigF:WaitForChild("World"))
local Day = require(ConfigF:WaitForChild("Day"))
local Weather = require(ConfigF:WaitForChild("Weather"))
local Night = require(ConfigF:WaitForChild("Night"))
local WC = require(ConfigF:WaitForChild("WeatherCycle"))

local Clock = {}
Clock.State = State
Clock.Math = WorldMath

local PHASES, LENGTH = WorldMath.normPhases(Day.PHASES)
Clock.PHASES = PHASES
Clock.LENGTH = LENGTH
Clock.ORIGIN = (typeof(World.ORIGIN) == "Vector3") and World.ORIGIN or Vector3.new(0, 10, 0)

local NO_STORM = Weather.NO_STORM_REGIONS or { forge = true }
local SNOW = Weather.SNOW_REGIONS or { ice = true }
local JITTER = Weather.CURRENT_JITTER or 0.2

function Clock.now(): number
	return workspace:GetServerTimeNow()
end

-- ===== кэш атрибутов =====
local dirty = true
local cache = {}

State.AttributeChanged:Connect(function()
	dirty = true
end)

-- сервер пишет атрибуты и тут же читает Clock в том же потоке (сигналы отложены) — сбросить кэш вручную
function Clock.invalidate()
	dirty = true
end

local function refresh()
	if not dirty then
		return cache
	end
	dirty = false
	cache.epoch = State:GetAttribute("DayEpoch") or 0
	cache.offset = State:GetAttribute("DayOffset") or 0
	cache.weather = State:GetAttribute("Weather") or "clear"
	cache.prev = State:GetAttribute("WeatherPrev") or "clear"
	cache.w0 = State:GetAttribute("WeatherT0") or 0
	cache.w1 = State:GetAttribute("WeatherT1") or 0
	local t0 = State:GetAttribute("StormT0")
	local from = State:GetAttribute("StormFrom")
	local dir = State:GetAttribute("StormDir")
	if typeof(t0) == "number" and typeof(from) == "Vector3" and typeof(dir) == "Vector3" then
		cache.front = {
			x0 = from.X,
			z0 = from.Z,
			dx = dir.X,
			dz = dir.Z,
			speed = State:GetAttribute("StormSpeed") or 18,
			width = State:GetAttribute("StormWidth") or 2800,
			depth = State:GetAttribute("StormDepth") or 1100,
			t0 = t0,
			t1 = State:GetAttribute("StormT1") or t0,
			tEnd = State:GetAttribute("StormEnd") or t0,
			seed = State:GetAttribute("StormSeed") or 0,
			rampIn = WC.FRONT.RAMP_IN,
			top = WC.FRONT.TOP,
			edge = WC.FRONT.EDGE,
		}
	else
		cache.front = nil
	end
	return cache
end

-- ===== сутки =====

-- место в цикле, с (0..LENGTH)
function Clock.cycle(t: number?): number
	local c = refresh()
	return WorldMath.cyclePos(t or Clock.now(), c.epoch, c.offset, LENGTH)
end

-- часы (0–24), фаза, доля фазы, ночь 0–1, закат 0–1, рассвет 0–1
function Clock.day(t: number?)
	local cyc = Clock.cycle(t)
	local clock, phase, p = WorldMath.dayAt(cyc, PHASES, Night.CLOCK)
	return {
		clock = clock,
		phase = phase,
		p = p,
		night = WorldMath.nightFactor(clock),
		sunset = WorldMath.sunsetFactor(clock),
		dawn = WorldMath.dawnFactor(clock),
		cycle = cyc,
	}
end

-- ===== погода =====

function Clock.weather()
	local c = refresh()
	return c.weather, c.w0, c.w1, c.prev
end

-- общая облачность по миру 0–1 (плавно на сменах)
function Clock.overcast(t: number?): number
	t = t or Clock.now()
	local c = refresh()
	local w, t0 = c.weather, c.w0
	if w == "cloudy" then
		local k = WorldMath.smooth(t0, t0 + 25, t)
		if c.prev ~= "clear" then
			k = 1
		end
		-- к концу облачности, если дальше ясно, — не знаем заранее; держим
		return k
	elseif w == "storm" or w == "rain" then
		return 1
	elseif w == "rainbow" then
		return 1 - WorldMath.smooth(t0, t0 + 30, t)
	end
	-- clear
	if c.prev == "cloudy" or c.prev == "rain" then
		return 1 - WorldMath.smooth(t0, t0 + 25, t)
	end
	return 0
end

-- радуга 0–1
function Clock.rainbow(t: number?): number
	t = t or Clock.now()
	local c = refresh()
	if c.weather ~= "rainbow" then
		return 0
	end
	return WorldMath.smooth(c.w0, c.w0 + 12, t) * (1 - WorldMath.smooth(c.w1 - 20, c.w1, t))
end

-- фронт грозы (таблица для WorldMath) или nil
function Clock.front(t: number?)
	local c = refresh()
	local f = c.front
	if not f then
		return nil
	end
	t = t or Clock.now()
	if t >= f.tEnd or t < f.t0 - 1 then
		return nil
	end
	return f
end

-- жизнь фронта 0–1 (по всему миру)
function Clock.stormLife(t: number?): number
	t = t or Clock.now()
	local f = Clock.front(t)
	if not f then
		return 0
	end
	return WorldMath.frontEnvelope(f, t)
end

local function regionAt(pos: Vector3)
	if World.regionAt then
		local ok, r = pcall(World.regionAt, pos)
		if ok then
			return r
		end
	end
	return nil
end
Clock.regionAt = regionAt

local function inExclusion(pos: Vector3): boolean
	if World.inExclusion then
		local ok, r = pcall(World.inExclusion, pos)
		if ok then
			return r == true
		end
	end
	return false
end
Clock.inExclusion = inExclusion

-- сила грозы в точке 0–1, метель ли там, регион.
-- Кузница (NO_STORM_REGIONS) и зоны других режимов (World.EXCLUSION) — всегда 0.
function Clock.stormAt(pos: Vector3, t: number?)
	t = t or Clock.now()
	local f = Clock.front(t)
	if not f then
		return 0, false, nil
	end
	local I = WorldMath.frontIntensity(f, pos.X, pos.Y - Clock.ORIGIN.Y, pos.Z, t)
	if I <= 0 then
		return 0, false, nil
	end
	local region = regionAt(pos)
	if region and NO_STORM[region] then
		return 0, false, region
	end
	if inExclusion(pos) then
		return 0, false, region
	end
	return I, (region ~= nil and SNOW[region] == true), region
end

-- можно ли сейчас бить молниям (гроза, не стихающий дождь)
function Clock.lightningOn(t: number?): boolean
	t = t or Clock.now()
	local f = Clock.front(t)
	return f ~= nil and WorldMath.frontLightning(f, t) > 0
end

-- центр фронта (Vector3 на высоте ORIGIN.Y) и направление
function Clock.frontCenter(t: number?)
	t = t or Clock.now()
	local f = Clock.front(t)
	if not f then
		return nil, nil
	end
	local x, z = WorldMath.frontCenter(f, t)
	return Vector3.new(x, Clock.ORIGIN.Y, z), Vector3.new(f.dx, 0, f.dz)
end

-- множитель скорости течений: 1 ± CURRENT_JITTER в грозу (одинаково у сервера и игроков)
function Clock.jitter(t: number?): number
	t = t or Clock.now()
	local f = Clock.front(t)
	if not f then
		return 1
	end
	return WorldMath.jitter(t, f.seed, JITTER, WorldMath.frontEnvelope(f, t))
end

return Clock
]==])

put("ReplicatedStorage/Archipelago/WorldFX", "ModuleScript", [==[
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
]==])

put("ReplicatedStorage/Archipelago/WorldMath", "ModuleScript", [==[
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
]==])

put("ServerScriptService/Archipelago/Stage4Progress", "ModuleScript", [==[
--!nonstrict
-- Stage4Progress — переходник этапа 4 к модулю Progress (исходник не приложен).
-- Ожидаемый API (из договорённостей): Progress.ATTR[key] → имя атрибута игрока (его сохраняет
-- ArchProfileServer), Progress.set(plr, key) → набор {[id] = true}, Progress.encode(набор) → строка.
-- TODO(studio): сверить с исходником Progress, что set(plr, key) — ЧТЕНИЕ набора (не запись).
-- Если иначе — поправить только getSet/add ниже, остальной код этапа 4 вызывает лишь их.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Arch = ReplicatedStorage:WaitForChild("Archipelago")

local Progress
pcall(function()
	Progress = require(Arch:WaitForChild("Progress", 10))
end)

local P = {}

local function attrName(key: string): string
	if Progress and type(Progress.ATTR) == "table" and type(Progress.ATTR[key]) == "string" then
		return Progress.ATTR[key]
	end
	-- TODO(studio): ключа нет в Progress.ATTR — добавить туда (иначе не сохранится между входами)
	return "Arch_" .. key
end
P.attrName = attrName

-- разбор строки на случай, если Progress.set недоступен: "a,b;c d" → {a=true,b=true,c=true,d=true}
local function parse(raw): { [string]: boolean }
	local s = {}
	if type(raw) == "string" then
		for id in string.gmatch(raw, "[^,;%s]+") do
			s[id] = true
		end
	end
	return s
end

function P.getSet(plr: Player, key: string): { [string]: boolean }
	if Progress and type(Progress.set) == "function" and type(Progress.ATTR) == "table" and Progress.ATTR[key] then
		local ok, s = pcall(Progress.set, plr, key)
		if ok and type(s) == "table" then
			return s
		end
	end
	return parse(plr:GetAttribute(attrName(key)))
end

function P.has(plr: Player, key: string, id: string): boolean
	return P.getSet(plr, key)[id] == true
end

-- добавить id в набор key. true — добавлено впервые
function P.add(plr: Player, key: string, id: string): boolean
	local s = P.getSet(plr, key)
	if s[id] then
		return false
	end
	s[id] = true
	local encoded
	if Progress and type(Progress.encode) == "function" then
		local ok, e = pcall(Progress.encode, s)
		if ok and type(e) == "string" then
			encoded = e
		end
	end
	if not encoded then
		local list = {}
		for k in pairs(s) do
			table.insert(list, k)
		end
		table.sort(list)
		encoded = table.concat(list, ",")
	end
	plr:SetAttribute(attrName(key), encoded)
	return true
end

-- флаги этапа 4 (встретил Стража и т. п.) — в наборе "secrets" нельзя (это счётчик секретов),
-- поэтому отдельный набор "flags". TODO(studio): добавить Progress.ATTR.flags, чтобы сохранялся.
function P.flag(plr: Player, id: string): boolean
	return P.has(plr, "flags", id)
end

function P.setFlag(plr: Player, id: string)
	return P.add(plr, "flags", id)
end

return P
]==])

put("ServerScriptService/Archipelago/WorldBus", "ModuleScript", [==[
--!nonstrict
-- WorldBus — серверная шина этапа 4: BindableFunction в ServerStorage.ArchWorldBus (панель разработчика,
-- проверка Stage4Check), общие проверки «игрок в мире» и создание RemoteEvent этапа 4.

local ServerStorage = game:GetService("ServerStorage")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Arch = ReplicatedStorage:WaitForChild("Archipelago")

local Bus = {}

local function folder(): Folder
	local f = ServerStorage:FindFirstChild("ArchWorldBus")
	if not f then
		f = Instance.new("Folder")
		f.Name = "ArchWorldBus"
		f.Parent = ServerStorage
	end
	return f
end

-- обработчик команд: fn(cmd, ...) -> any
function Bus.serve(name: string, fn)
	local f = folder()
	local b = f:FindFirstChild(name)
	if not b then
		b = Instance.new("BindableFunction")
		b.Name = name
		b.Parent = f
	end
	b.OnInvoke = fn
	return b
end

-- вызвать чужой обработчик (ждёт его появления до timeout)
function Bus.call(name: string, timeout: number?, ...)
	local b = folder():WaitForChild(name, timeout or 5)
	if not b then
		return nil
	end
	return b:Invoke(...)
end

-- RemoteEvent этапа 4 в Remotes (создаём, если нет)
function Bus.remote(name: string): RemoteEvent
	local remotes = Arch:WaitForChild("Remotes")
	local r = remotes:FindFirstChild(name)
	if not r then
		r = Instance.new("RemoteEvent")
		r.Name = name
		r.Parent = remotes
	end
	return r
end

local FlightShared
do
	local ok, m = pcall(function()
		return require(Arch:WaitForChild("FlightShared", 10))
	end)
	if ok and type(m) == "table" then
		FlightShared = m
	end
end

local function busy(inst)
	return inst ~= nil
		and (inst:GetAttribute("InDuel") or inst:GetAttribute("NimbusInMatch") or inst:GetAttribute("NimbusInRoulette"))
end

-- игрок в открытом мире (доступ + Zone == World + не в матче)
function Bus.inWorld(plr: Player): boolean
	if plr:GetAttribute("WorldAccess") ~= true then
		return false
	end
	if FlightShared and type(FlightShared.cloudReturn) == "function" then
		local ok, r = pcall(FlightShared.cloudReturn, plr)
		if ok and type(r) == "boolean" then
			return r
		end
	end
	if plr:GetAttribute("Zone") ~= "World" then
		return false
	end
	return not (busy(plr) or busy(plr.Character))
end

-- живой персонаж игрока: hrp, hum
function Bus.body(plr: Player)
	local char = plr.Character
	if not char then
		return nil, nil, nil
	end
	local hrp = char:FindFirstChild("HumanoidRootPart")
	local hum = char:FindFirstChildOfClass("Humanoid")
	if not hrp or not hum or hum.Health <= 0 then
		return nil, nil, nil
	end
	return hrp, hum, char
end

-- без PvP (хаб, рядом с маяками)
function Bus.noPvp(pos: Vector3): boolean
	if FlightShared and type(FlightShared.noPvp) == "function" then
		local ok, r = pcall(FlightShared.noPvp, pos)
		return ok and r == true
	end
	return false
end

-- сложить крылья (FlightClient сам рассыпает, если игрок в режиме wings)
local FlightCfg
pcall(function()
	FlightCfg = require(Arch.Config:WaitForChild("Flight", 10))
end)

function Bus.foldWings(char: Model, why: string)
	if char:GetAttribute("FlightState") ~= "Wings" then
		return false
	end
	local t = (FlightCfg and FlightCfg.HIT_FOLD_TIME) or 1.5
	char:SetAttribute("FlightStunUntil", workspace:GetServerTimeNow() + t)
	char:SetAttribute("FlightStunWhy", why)
	return true
end

return Bus
]==])

put("ServerScriptService/Archipelago/CreaturesServer", "Script", [==[
--!nonstrict
-- CreaturesServer — серверная часть существ:
--  • медуза: игрок прислал «прыгнул» → сверяем место медузы по времени и откат → +1 ArchLight (≤ ArchLightMax);
--  • секрет на спине «Старого кита»: сверяем расстояние до страницы по времени → секрет + страница летописи;
--  • шина Creatures: телепорт на кита (панель разработчика), сводка для проверки.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Arch = ReplicatedStorage:WaitForChild("Archipelago")
local ConfigF = Arch:WaitForChild("Config")
local Life = require(ConfigF:WaitForChild("Life"))
local Creatures = require(ConfigF:WaitForChild("Creatures"))
local Movers = Arch:WaitForChild("Movers")
local Whales = require(Movers:WaitForChild("Whales"))
local Jellies = require(Movers:WaitForChild("Jellies"))
local Bus = require(script.Parent:WaitForChild("WorldBus"))
local Prog = require(script.Parent:WaitForChild("Stage4Progress"))

local remote = Bus.remote("Creatures")
local J = Life.JELLY
local LIGHT = (Creatures.JELLY and Creatures.JELLY.LIGHT) or 1
local SECRET = Life.WHALE_SECRET

local lastAsk = {} -- [plr] = время последнего запроса
local jellyCd = {} -- [plr] = {["g:j"] = время, когда снова можно}
local secretAsk = {} -- [plr] = время

local function now()
	return workspace:GetServerTimeNow()
end

-- минимальное расстояние до точки, посчитанной в t, t-0.3, t-0.6 (пинг)
local function nearOverTime(fn, hrpPos: Vector3): number
	local t = now()
	local best = math.huge
	for _, back in ipairs({ 0, 0.3, 0.6 }) do
		local p = fn(t - back)
		if p then
			best = math.min(best, (p - hrpPos).Magnitude)
		end
	end
	return best
end

local function onJelly(plr: Player, g, j)
	if type(g) ~= "number" or type(j) ~= "number" or g ~= g or j ~= j then
		return
	end
	g, j = math.floor(g), math.floor(j)
	if not Jellies.groups[g] or not Jellies.groups[g].items[j] then
		return
	end
	local t = os.clock()
	if (lastAsk[plr] or 0) + J.RATE > t then
		return
	end
	lastAsk[plr] = t
	if not Bus.inWorld(plr) then
		return
	end
	local hrp = Bus.body(plr)
	if not hrp then
		return
	end
	local key = g .. ":" .. j
	jellyCd[plr] = jellyCd[plr] or {}
	if (jellyCd[plr][key] or 0) > t then
		return
	end
	local d = nearOverTime(function(tt)
		return Jellies.top(g, j, tt)
	end, hrp.Position)
	if d > J.CHECK_RADIUS then
		return
	end
	jellyCd[plr][key] = t + J.COOLDOWN
	local cur = plr:GetAttribute("ArchLight")
	local max = plr:GetAttribute("ArchLightMax")
	if type(cur) == "number" and type(max) == "number" then
		local new = math.min(cur + LIGHT, max)
		if new > cur then
			plr:SetAttribute("ArchLight", new)
		end
		remote:FireClient(plr, "jellyOk", g, j, new)
	end
end

local function pagePos(w, t: number): Vector3
	return (Whales.backAt(w, t) * Whales.GARDEN_PAGE).Position
end

local function onWhaleSecret(plr: Player)
	local t = os.clock()
	if (secretAsk[plr] or 0) > t then
		return
	end
	secretAsk[plr] = t + 2
	if not Bus.inWorld(plr) then
		return
	end
	local hrp = Bus.body(plr)
	local w = Whales.byId(SECRET.whale)
	if not hrp or not w then
		return
	end
	local d = nearOverTime(function(tt)
		return pagePos(w, tt)
	end, hrp.Position)
	if d > SECRET.radius then
		return
	end
	local newSecret = Prog.add(plr, "secrets", SECRET.secret)
	local newLore = Prog.add(plr, "lore", SECRET.lore)
	if newSecret or newLore then
		remote:FireClient(plr, "secretOk", SECRET.secret, false)
	else
		remote:FireClient(plr, "secretOk", SECRET.secret, true)
	end
end

remote.OnServerEvent:Connect(function(plr, kind, a, b)
	if kind == "jelly" then
		onJelly(plr, a, b)
	elseif kind == "whaleSecret" then
		onWhaleSecret(plr)
	end
end)

-- уже нашёл секрет раньше — страница у него не светится
local function onJoin(plr: Player)
	task.delay(6, function()
		if plr.Parent and Prog.has(plr, "secrets", SECRET.secret) then
			remote:FireClient(plr, "secretOk", SECRET.secret, true)
		end
	end)
end
Players.PlayerAdded:Connect(onJoin)
for _, plr in ipairs(Players:GetPlayers()) do
	onJoin(plr)
end

Players.PlayerRemoving:Connect(function(plr)
	lastAsk[plr] = nil
	jellyCd[plr] = nil
	secretAsk[plr] = nil
end)

-- ===== шина =====

Bus.serve("Creatures", function(cmd, a, b)
	if cmd == "whaleTp" then
		local plr = a
		if typeof(plr) ~= "Instance" or not plr:IsA("Player") then
			return false, "нужен игрок"
		end
		local n = math.clamp(tonumber(b) or 1, 1, #Whales.list)
		local w = Whales.list[n]
		local _, _, char = Bus.body(plr)
		if not char then
			return false, "нет персонажа"
		end
		-- чуть вперёд по времени: пока телепорт дойдёт, кит подплывёт
		local cf = Whales.backAt(w, now() + 0.25) * CFrame.new(0, 5, 0)
		char:PivotTo(cf)
		return true, w.id
	elseif cmd == "info" then
		local t = now()
		local out = { whales = {}, audit = Whales.audit(), groups = #Jellies.groups }
		for _, w in ipairs(Whales.list) do
			table.insert(out.whales, { id = w.id, head = Whales.headAt(w, t), period = w.period })
		end
		return out
	elseif cmd == "whaleAt" then
		-- место кита n в момент b (для проверки синхронности)
		local w = Whales.list[tonumber(a) or 1]
		return w and Whales.headAt(w, tonumber(b) or now()) or nil
	end
	return nil
end)
]==])

put("ServerScriptService/Archipelago/DayNightServer", "Script", [==[
--!nonstrict
-- DayNightServer — сутки мира (24 мин, фазы из Config.Day.PHASES).
-- Пишет WorldState: DayEpoch, DayOffset, DayLength, DayPhase, DayClock. Lighting на сервере НЕ трогает:
-- свет суток — клиентский слой daynight (NightClient) через LightingDirector.
-- Закатный остров (тег ArchSunsetOnly): виден только в фазе sunset, остальное время лежит в ServerStorage.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")
local CollectionService = game:GetService("CollectionService")

local Arch = ReplicatedStorage:WaitForChild("Archipelago")
local State = Arch:WaitForChild("WorldState")
local Night = require(Arch.Config:WaitForChild("Night"))
local Clock = require(Arch:WaitForChild("WorldClock"))
local WorldMath = require(Arch:WaitForChild("WorldMath"))
local Bus = require(script.Parent:WaitForChild("WorldBus"))

local L = Clock.LENGTH

-- старт: начало START_PHASE прямо сейчас
local now = workspace:GetServerTimeNow()
local startAt = WorldMath.phaseStart(Night.START_PHASE or "day", Clock.PHASES)
State:SetAttribute("DayLength", L)
State:SetAttribute("DayOffset", 0)
State:SetAttribute("DayEpoch", now - startAt)
Clock.invalidate()

-- ===== закатный остров =====

local hiddenFolder = ServerStorage:FindFirstChild(Night.SUNSET.HIDDEN_FOLDER)
if not hiddenFolder then
	hiddenFolder = Instance.new("Folder")
	hiddenFolder.Name = Night.SUNSET.HIDDEN_FOLDER
	hiddenFolder.Parent = ServerStorage
end

local homeOf = {} -- [inst] = родитель в Workspace
local sunsetVisible = nil

local function placeSunset(inst: Instance, visible: boolean)
	local home = homeOf[inst]
	if not home then
		return
	end
	if visible then
		if inst.Parent ~= home then
			inst.Parent = home
		end
	elseif inst.Parent ~= hiddenFolder then
		inst.Parent = hiddenFolder
	end
end

local function track(inst: Instance)
	if homeOf[inst] then
		return
	end
	if not inst:IsDescendantOf(workspace) then
		return
	end
	homeOf[inst] = inst.Parent
	inst:SetAttribute("SunsetOnly", true)
	placeSunset(inst, sunsetVisible == true)
end

for _, inst in ipairs(CollectionService:GetTagged("ArchSunsetOnly")) do
	track(inst)
end
CollectionService:GetInstanceAddedSignal("ArchSunsetOnly"):Connect(track)
CollectionService:GetInstanceRemovedSignal("ArchSunsetOnly"):Connect(function(inst)
	homeOf[inst] = nil
end)

local function setSunsetVisible(v: boolean)
	if sunsetVisible == v then
		return
	end
	local first = sunsetVisible == nil
	sunsetVisible = v
	State:SetAttribute("SunsetIsland", v)
	local function apply()
		if sunsetVisible ~= v then
			return
		end
		for inst in pairs(homeOf) do
			if inst.Parent then
				placeSunset(inst, v)
			end
		end
	end
	if v or first then
		apply()
	else
		-- игроки успевают растворить остров (NightClient), потом прячем
		task.delay(Night.SUNSET.FADE, apply)
	end
end

-- ===== ход суток =====

local lastPhase = nil
local function tick()
	local info = Clock.day()
	if info.phase ~= lastPhase then
		lastPhase = info.phase
		State:SetAttribute("DayPhase", info.phase)
	end
	State:SetAttribute("DayClock", math.floor(info.clock * 100 + 0.5) / 100)
	setSunsetVisible(info.phase == "sunset")
end

-- ===== шина: панель разработчика и проверка =====

local function setCycle(target: number)
	local t = workspace:GetServerTimeNow()
	local epoch = State:GetAttribute("DayEpoch") or 0
	local raw = (t - epoch) % L
	State:SetAttribute("DayOffset", (target - raw) % L)
	Clock.invalidate()
	tick()
end

Bus.serve("Day", function(cmd, a)
	if cmd == "hour" then
		local h = tonumber(a)
		if not h then
			return false, "нужен час 0–24"
		end
		setCycle((WorldMath.cycleForClock(h, Clock.PHASES, Night.CLOCK)))
		return true, Clock.day()
	elseif cmd == "phase" then
		local found = false
		for _, ph in ipairs(Clock.PHASES) do
			if ph.name == a then
				found = true
			end
		end
		if not found then
			return false, "фазы: dawn day sunset night predawn"
		end
		setCycle(WorldMath.phaseStart(a, Clock.PHASES) + 0.5)
		return true, Clock.day()
	elseif cmd == "info" then
		local info = Clock.day()
		info.length = L
		info.sunsetIsland = sunsetVisible
		local count = 0
		for _ in pairs(homeOf) do
			count += 1
		end
		info.sunsetModels = count
		return info
	end
	return nil
end)

tick()
while true do
	task.wait(1)
	tick()
end
]==])

put("ServerScriptService/Archipelago/GuardianServer", "Script", [==[
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
]==])

put("ServerScriptService/Archipelago/Stage4Check", "Script", [==[
--!nonstrict
-- Stage4Check — проверка этапа 4 одним Play-тестом (ТОЛЬКО в Studio, в игре сразу выходит).
-- Итог — в атрибутах первого игрока: Stage4_Day, Stage4_Weather, Stage4_Whale, Stage4_Guardian
-- (строка «OK …» или «FAIL …»), Stage4_OK (true/false), Stage4_Report, Stage4_Done.
-- Прочитать в Studio одним запросом: game.Players:GetPlayers()[1]:GetAttributes().
-- Внимание: тест сдвигает время суток, зовёт грозу к игроку и прогоняет Стража по фазам.

local RunService = game:GetService("RunService")
if not RunService:IsStudio() then
	return
end

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")
local CollectionService = game:GetService("CollectionService")

local Arch = ReplicatedStorage:WaitForChild("Archipelago")
local State = Arch:WaitForChild("WorldState")
local Clock = require(Arch:WaitForChild("WorldClock"))
local WorldMath = require(Arch:WaitForChild("WorldMath"))
local Night = require(Arch.Config:WaitForChild("Night"))
local WC = require(Arch.Config:WaitForChild("WeatherCycle"))
local GCfg = require(Arch.Config:WaitForChild("Guardian"))
local Whales = require(Arch:WaitForChild("Movers"):WaitForChild("Whales"))
local Bus = require(script.Parent:WaitForChild("WorldBus"))

local plr = Players:GetPlayers()[1] or Players.PlayerAdded:Wait()
task.wait(8) -- системы успели запуститься

local results = {}
local function report(key: string, ok: boolean, text: string)
	local line = (ok and "OK " or "FAIL ") .. text
	results[key] = ok
	plr:SetAttribute("Stage4_" .. key, line)
	print("[Stage4Check] " .. key .. ": " .. line)
end

local function safe(fn)
	local ok, a, b = pcall(fn)
	if not ok then
		return false, "ошибка: " .. tostring(a)
	end
	return a, b
end

-- ===== сутки =====
report("Day", safe(function()
	local info = Bus.call("Day", 5, "info")
	if type(info) ~= "table" then
		return false, "нет шины Day (DayNightServer не запущен?)"
	end
	if Clock.LENGTH ~= 1440 then
		return false, "длина суток " .. Clock.LENGTH .. " ≠ 1440"
	end
	for _, k in ipairs({ "DayEpoch", "DayOffset", "DayLength", "DayPhase", "DayClock" }) do
		if State:GetAttribute(k) == nil then
			return false, "нет WorldState." .. k
		end
	end
	-- все фазы по кругу и закатный остров
	local seen = {}
	for c = 0, Clock.LENGTH - 1, 5 do
		local _, name = WorldMath.dayAt(c, Clock.PHASES, Night.CLOCK)
		seen[name] = true
	end
	for _, n in ipairs({ "dawn", "day", "sunset", "night", "predawn" }) do
		if not seen[n] then
			return false, "в цикле нет фазы " .. n
		end
	end
	local oldOffset = State:GetAttribute("DayOffset")
	local probe = Instance.new("Part")
	probe.Name = "Stage4SunsetProbe"
	probe.Anchored = true
	probe.Transparency = 1
	probe.CanCollide = false
	probe.Position = Clock.ORIGIN + Vector3.new(0, -2000, 0)
	probe.Parent = workspace
	CollectionService:AddTag(probe, "ArchSunsetOnly")
	Bus.call("Day", 5, "hour", 12)
	task.wait(Night.SUNSET.FADE + 1.5) -- прячется после растворения
	local hiddenAtNoon = probe.Parent ~= nil and not probe:IsDescendantOf(workspace)
	local ok18, at18 = Bus.call("Day", 5, "hour", 18)
	task.wait(1.5)
	local shownAtSunset = probe:IsDescendantOf(workspace)
	-- вернуть
	CollectionService:RemoveTag(probe, "ArchSunsetOnly")
	probe:Destroy()
	State:SetAttribute("DayOffset", oldOffset)
	if not ok18 or type(at18) ~= "table" or at18.phase ~= "sunset" then
		return false, "time 18 ≠ sunset"
	end
	if not hiddenAtNoon or not shownAtSunset then
		return false, "закатный остров: днём спрятан=" .. tostring(hiddenAtNoon) .. ", на закате виден=" .. tostring(shownAtSunset)
	end
	return true, string.format("сутки 24 мин, 5 фаз, time→ClockTime, закатный остров ок (сейчас %s %.1f ч)", info.phase, info.clock)
end))

-- ===== погода =====
report("Weather", safe(function()
	local info = Bus.call("Weather", 5, "info")
	if type(info) ~= "table" then
		return false, "нет шины Weather"
	end
	local hrp = plr.Character and plr.Character:FindFirstChild("HumanoidRootPart")
	local pos = hrp and hrp.Position or Clock.ORIGIN
	local ok = Bus.call("Weather", 5, "set", "storm", pos)
	if not ok then
		return false, "weather storm не сработал"
	end
	task.wait(0.5)
	if State:GetAttribute("Weather") ~= "storm" then
		return false, "Weather ≠ storm"
	end
	local f = Clock.front()
	if not f then
		return false, "фронт не записан в WorldState"
	end
	local arrive = State:GetAttribute("StormT0") + WC.FRONT.DEV_ARRIVE + 30
	local I = Clock.stormAt(pos, arrive)
	local inForge = Clock.regionAt(pos) == "forge"
	if not inForge and I < 0.5 then
		return false, string.format("гроза не дойдёт до игрока (сила %.2f)", I)
	end
	local j = Clock.jitter(arrive)
	-- путь не задевает исключённые зоны
	local bad = 0
	for _, p in ipairs(WorldMath.frontSamples(f, 16, 3)) do
		if Clock.inExclusion(Vector3.new(p[1], Clock.ORIGIN.Y, p[2])) then
			bad += 1
		end
	end
	local struck = Bus.call("Weather", 5, "strike", pos + Vector3.new(120, 0, 0))
	return true, string.format("гроза к игроку: сила %.2f, дрожь течений %.2f, молния %s, точек в зонах режимов %d (гроза оставлена — смотреть)", I, j, tostring(struck), bad)
end))

-- ===== киты =====
report("Whale", safe(function()
	local info = Bus.call("Creatures", 5, "info")
	if type(info) ~= "table" then
		return false, "нет шины Creatures"
	end
	if #info.whales ~= 3 then
		return false, "китов " .. #info.whales
	end
	local notes = {}
	for _, a in ipairs(info.audit) do
		if not a.lengthOk or not a.periodOk then
			return false, string.format("кит %s: длина %d, круг %d с", a.id, a.length, a.period)
		end
		if a.exclusionHits > 0 then
			return false, string.format("кит %s заходит в зоны режимов (%d точек)", a.id, a.exclusionHits)
		end
		table.insert(notes, string.format("%s %d/%dс", a.id, a.length, a.period))
	end
	-- одна формула = одно место: шина (CreaturesServer) и этот скрипт считают одинаково
	local T = workspace:GetServerTimeNow() + 1.234
	local p1 = Bus.call("Creatures", 5, "whaleAt", 2, T)
	local p2 = Whales.headAt(Whales.list[2], T)
	if typeof(p1) ~= "Vector3" or (p1 - p2).Magnitude > 0.01 then
		return false, "место кита расходится"
	end
	return true, "3 кита: " .. table.concat(notes, ", ") .. "; место по времени совпадает"
end))

-- ===== Страж =====
-- (через функцию: анализатор не «сужает» тип состояния между вызовами)
local function ginfo(): any
	return Bus.call("Guardian", 5, "info")
end
report("Guardian", safe(function()
	local okHooks, Hooks = pcall(function()
		return require(ServerStorage:WaitForChild("HaloHooks", 5))
	end)
	if not okHooks or type(Hooks) ~= "table" or type(Hooks.damage) ~= "function" then
		return false, "нет HaloHooks.damage"
	end
	local info = ginfo()
	if type(info) ~= "table" then
		return false, "нет шины Guardian"
	end
	if not info.model or not info.hasHumanoid or info.zone ~= "World" then
		return false, "модель/Humanoid/Zone"
	end
	Bus.call("Guardian", 5, "reset")
	task.wait(0.3)
	Bus.call("Guardian", 5, "wake")
	task.wait(GCfg.INTRO + 0.6)
	info = ginfo()
	if tostring(info.state) ~= "fight" then
		return false, "после пробуждения состояние " .. tostring(info.state)
	end
	local model = workspace.Archipelago.Guardian:FindFirstChild("TempleGuardian")
	local hum = model and model:FindFirstChildOfClass("Humanoid")
	if not hum then
		return false, "нет Humanoid"
	end
	-- удар по Стражу через HaloHooks (как способность); если не прошёл — напрямую (проверяем логику фаз)
	local before = hum.Health
	pcall(Hooks.damage, hum, 1, workspace)
	task.wait(0.2)
	local hooksHit = hum.Health < before
	hum.Health = hum.MaxHealth * 0.5
	task.wait(0.4)
	info = ginfo()
	if tostring(info.state) ~= "transition" then
		return false, "на 50% нет перехода (" .. tostring(info.state) .. ")"
	end
	task.wait(GCfg.TRANSITION + 0.5)
	info = ginfo()
	if info.phase ~= 2 then
		return false, "фаза после перехода " .. tostring(info.phase)
	end
	hum = model:FindFirstChildOfClass("Humanoid")
	hum.Health = hum.MaxHealth * 0.1
	task.wait(GCfg.TRANSITION + 0.9)
	info = ginfo()
	if info.phase ~= 3 then
		return false, "третья фаза не началась (" .. tostring(info.phase) .. ")"
	end
	hum = model:FindFirstChildOfClass("Humanoid")
	hum.Health = 0
	task.wait(0.5)
	info = ginfo()
	if tostring(info.state) ~= "dead" then
		return false, "не умер (" .. tostring(info.state) .. ")"
	end
	Bus.call("Guardian", 5, "spawn")
	task.wait(0.5)
	info = ginfo()
	if tostring(info.state) ~= "dormant" or info.health ~= info.maxHealth then
		return false, "не возродился (" .. tostring(info.state) .. ")"
	end
	return true, "пробуждение → бой, фазы 1→2→3, смерть, возрождение; HaloHooks.damage по Стражу: " .. (hooksHit and "проходит" or "НЕ проходит (проверить зоны Hooks)")
end))

local all = results.Day and results.Weather and results.Whale and results.Guardian
plr:SetAttribute("Stage4_OK", all == true)
local parts = {}
for _, k in ipairs({ "Day", "Weather", "Whale", "Guardian" }) do
	table.insert(parts, k .. "=" .. (results[k] and "ok" or "FAIL"))
end
plr:SetAttribute("Stage4_Report", table.concat(parts, " "))
plr:SetAttribute("Stage4_Done", true)
print("[Stage4Check] ИТОГ: " .. table.concat(parts, " "))
]==])

put("ServerScriptService/Archipelago/WeatherServer", "Script", [==[
--!nonstrict
-- WeatherServer — погода мира: ясно → облачно → гроза (фронт идёт через часть мира) → дождь стихает → радуга.
-- Порядок случайный, с весами (Config.WeatherCycle.WEIGHTS), длительности — Config.Weather.
-- Пишет WorldState (Weather*, Storm*), бьёт молниями (сбивает крылья летящим, толкает стоящих),
-- дрожит течениями (Flows.jitter). Lighting на сервере не трогает.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local CollectionService = game:GetService("CollectionService")
local RunService = game:GetService("RunService")

local Arch = ReplicatedStorage:WaitForChild("Archipelago")
local ConfigF = Arch:WaitForChild("Config")
local State = Arch:WaitForChild("WorldState")
local Weather = require(ConfigF:WaitForChild("Weather"))
local WC = require(ConfigF:WaitForChild("WeatherCycle"))
local Clock = require(Arch:WaitForChild("WorldClock"))
local WorldMath = require(Arch:WaitForChild("WorldMath"))
local Bus = require(script.Parent:WaitForChild("WorldBus"))

local Flows
pcall(function()
	Flows = require(Arch:WaitForChild("Flows", 10))
end)

local remote = Bus.remote("Weather")
local ORIGIN = Clock.ORIGIN
local rng = Random.new(math.floor(workspace:GetServerTimeNow() * 1000) % 2147483647)

local DUR = {
	clear = Weather.CLEAR or { 8, 12 },
	cloudy = Weather.CLOUDY or 4,
	storm = Weather.STORM or { 5, 7 },
	rain = WC.RAIN or 1.5,
	rainbow = Weather.RAINBOW or 2,
}
local NO_STORM = Weather.NO_STORM_REGIONS or { forge = true }

local ver = 0
local current = "clear"
local firstCycle = true

local function now()
	return workspace:GetServerTimeNow()
end

-- ===== фронт =====

local function randRange(r)
	if type(r) == "table" then
		return rng:NextNumber(r[1], r[2])
	end
	return r
end

-- путь годится, если ни одна точка не в зонах других режимов и не в регионах без грозы
local function pathOk(f): boolean
	for _, p in ipairs(WorldMath.frontSamples(f, 16, 3)) do
		local pos = Vector3.new(p[1], ORIGIN.Y, p[2])
		if Clock.inExclusion(pos) then
			return false
		end
		local r = Clock.regionAt(pos)
		if r and NO_STORM[r] then
			return false
		end
	end
	return true
end

-- план фронта: через точку target (или регион по весам). arrive — через сколько секунд центр дойдёт до цели
local function planFront(t0: number, stormSec: number, rainSec: number, target: Vector3?, arrive: number?)
	local F = WC.FRONT
	local best
	for attempt = 1, F.TRIES do
		local aim
		if target then
			aim = target
		else
			local weights = {}
			for k, v in pairs(F.TARGETS) do
				weights[k] = v.w
			end
			local key = WorldMath.pickWeighted(weights, rng:NextNumber())
			local base = ORIGIN + F.TARGETS[key].pos
			aim = base + Vector3.new(rng:NextNumber(-1, 1) * F.SPREAD, 0, rng:NextNumber(-1, 1) * F.SPREAD)
		end
		local ang = rng:NextNumber(0, math.pi * 2)
		local dir = Vector3.new(math.cos(ang), 0, math.sin(ang))
		local speed = randRange(F.SPEED)
		local reach = arrive or stormSec * 0.5 -- к середине грозы фронт над целью
		local from = aim - dir * speed * reach
		local f = {
			x0 = from.X,
			z0 = from.Z,
			dx = dir.X,
			dz = dir.Z,
			speed = speed,
			width = randRange(F.WIDTH),
			depth = randRange(F.DEPTH),
			t0 = t0,
			t1 = t0 + stormSec,
			tEnd = t0 + stormSec + rainSec,
			rampIn = F.RAMP_IN,
			top = F.TOP,
			edge = F.EDGE,
			seed = rng:NextInteger(1, 999),
		}
		best = best or f
		if pathOk(f) then
			best = f
			break
		end
		if attempt == F.TRIES then
			warn("[WeatherServer] путь грозы мимо исключённых зон не найден — сила там гасится маской")
		end
	end
	return best
end

local function writeFront(f)
	State:SetAttribute("StormT0", f.t0)
	State:SetAttribute("StormT1", f.t1)
	State:SetAttribute("StormEnd", f.tEnd)
	State:SetAttribute("StormFrom", Vector3.new(f.x0, ORIGIN.Y, f.z0))
	State:SetAttribute("StormDir", Vector3.new(f.dx, 0, f.dz))
	State:SetAttribute("StormSpeed", f.speed)
	State:SetAttribute("StormWidth", f.width)
	State:SetAttribute("StormDepth", f.depth)
	State:SetAttribute("StormSeed", f.seed)
	Clock.invalidate()
end

-- ===== смена погоды =====

local function setWeather(name: string, seconds: number)
	local t = now()
	State:SetAttribute("WeatherPrev", current)
	current = name
	State:SetAttribute("Weather", name)
	State:SetAttribute("WeatherT0", t)
	State:SetAttribute("WeatherT1", t + seconds)
	ver += 1
	State:SetAttribute("WeatherVer", ver)
	Clock.invalidate()
end

local function startStorm(target: Vector3?, arrive: number?)
	local stormSec = WorldMath.duration(DUR.storm, rng:NextNumber())
	local rainSec = WorldMath.duration(DUR.rain, rng:NextNumber())
	local f = planFront(now(), stormSec, rainSec, target, arrive)
	writeFront(f)
	setWeather("storm", stormSec)
end

local function nextOf(name: string): string
	if firstCycle and WC.FIRST_STORM then
		if name == "clear" then
			return "cloudy"
		elseif name == "cloudy" then
			firstCycle = false
			return "storm"
		end
	end
	return WorldMath.pickWeighted(WC.WEIGHTS[name] or { clear = 1 }, rng:NextNumber()) or "clear"
end

local function advance()
	local nxt = nextOf(current)
	if nxt == "storm" then
		startStorm(nil, nil)
	elseif nxt == "rain" then
		-- фронт тот же: стихает до StormEnd
		local tEnd = State:GetAttribute("StormEnd") or (now() + 60)
		setWeather("rain", math.max(5, tEnd - now()))
	else
		setWeather(nxt, WorldMath.duration(DUR[nxt] or 2, rng:NextNumber()))
	end
end

-- старт: короткое ясно (гарантия грозы в первые 24 минуты)
setWeather("clear", (WC.FIRST_CLEAR or 6) * 60)

-- ===== молнии =====

local LZ = WC.LIGHTNING
local nextStrike = 0
local pending = {} -- {t, pos, groundY}

local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Include
local function refreshRayFilter()
	local wa = workspace:FindFirstChild("Archipelago")
	local list = {}
	if wa then
		local islands = wa:FindFirstChild("Islands")
		if islands then
			table.insert(list, islands)
		end
	end
	for _, rod in ipairs(CollectionService:GetTagged("ArchLightningRod")) do
		table.insert(list, rod)
	end
	rayParams.FilterDescendantsInstances = list
end

local function groundBelow(pos: Vector3): number
	local top = Vector3.new(pos.X, pos.Y + 4, pos.Z)
	local seaY = ORIGIN.Y + LZ.SEA_Y
	local hit = workspace:Raycast(top, Vector3.new(0, seaY - top.Y, 0), rayParams)
	if hit then
		return hit.Position.Y
	end
	return seaY
end

-- молния не бьёт в Кузницу, метель (лёд), зоны других режимов
local function strikeAllowed(pos: Vector3): boolean
	-- под облачным морем гроза не бьёт (там «укрытие», осадков тоже нет)
	if pos.Y < ORIGIN.Y + LZ.SEA_Y then
		return false
	end
	local I, snow = Clock.stormAt(pos)
	return I >= LZ.MIN_STORM and not snow
end

local function flyers()
	local list = {}
	for _, plr in ipairs(Players:GetPlayers()) do
		if Bus.inWorld(plr) then
			local hrp, _, char = Bus.body(plr)
			if hrp and char:GetAttribute("FlightState") == "Wings" and strikeAllowed(hrp.Position) then
				table.insert(list, hrp.Position)
			end
		end
	end
	return list
end

local function pickStrike(): Vector3?
	-- 1) рядом с летящим игроком внутри грозы
	if rng:NextNumber() < LZ.NEAR_FLYER then
		local fl = flyers()
		if #fl > 0 then
			local p = fl[rng:NextInteger(1, #fl)]
			local a = rng:NextNumber(0, math.pi * 2)
			local d = rng:NextNumber(LZ.NEAR_DIST[1], LZ.NEAR_DIST[2])
			local pos = p + Vector3.new(math.cos(a) * d, rng:NextNumber(-12, 12), math.sin(a) * d)
			-- точка ушла внутрь острова (игрок летит низко) — ставим её на поверхность
			local hit = workspace:Raycast(p, pos - p, rayParams)
			if hit then
				pos = hit.Position + hit.Normal * 2
			end
			if strikeAllowed(pos) then
				return pos
			end
		end
	end
	-- 2) громоотвод внутри фронта (выше — вероятнее)
	local rods = {}
	local total = 0
	for _, rod in ipairs(CollectionService:GetTagged("ArchLightningRod")) do
		if rod:IsA("BasePart") and rod:IsDescendantOf(workspace) then
			local top = rod.Position + Vector3.new(0, rod.Size.Y * 0.5, 0)
			if strikeAllowed(top) then
				local w = 1 + math.max(0, top.Y - ORIGIN.Y) / 200
				table.insert(rods, { top, w })
				total += w
			end
		end
	end
	if #rods > 0 and rng:NextNumber() < 0.6 then
		local x = rng:NextNumber() * total
		for _, r in ipairs(rods) do
			x -= r[2]
			if x <= 0 then
				return r[1]
			end
		end
		return rods[#rods][1]
	end
	-- 3) случайная точка во фронте → в землю под ней
	local f = Clock.front()
	if not f then
		return nil
	end
	local cx, cz = WorldMath.frontCenter(f, now())
	for _ = 1, 6 do
		local u = rng:NextNumber(-0.5, 0.5) * f.depth
		local v = rng:NextNumber(-0.5, 0.5) * f.width
		local x = cx + f.dx * u - f.dz * v
		local z = cz + f.dz * u + f.dx * v
		local probe = Vector3.new(x, ORIGIN.Y + 1400, z)
		local gy = groundBelow(probe)
		local pos = Vector3.new(x, gy, z)
		if strikeAllowed(pos) then
			return pos
		end
	end
	return nil
end

local function scheduleStrike()
	local pos = pickStrike()
	if not pos then
		return
	end
	local gy = groundBelow(pos)
	local tStrike = now() + LZ.TELEGRAPH
	local seed = rng:NextInteger(1, 1e6)
	table.insert(pending, { t = tStrike, pos = pos, groundY = gy })
	remote:FireAllClients("strike", pos, gy, tStrike, seed)
end

-- расстояние до вертикального столба молнии (от земли до тучи)
local function boltDist(p: Vector3, s): number
	local lo = s.groundY
	local hi = math.max(lo, s.pos.Y + LZ.BOLT_HEIGHT)
	local y = math.clamp(p.Y, lo, hi)
	local dx, dz = p.X - s.pos.X, p.Z - s.pos.Z
	local dy = p.Y - y
	return math.sqrt(dx * dx + dy * dy + dz * dz)
end

local function resolveStrike(s)
	for _, plr in ipairs(Players:GetPlayers()) do
		if Bus.inWorld(plr) then
			local hrp, _, char = Bus.body(plr)
			if hrp then
				local d = boltDist(hrp.Position, s)
				local flying = char:GetAttribute("FlightState") == "Wings"
				if flying and d <= LZ.STUN_RADIUS then
					Bus.foldWings(char, LZ.WHY)
					local away = Vector3.new(hrp.Position.X - s.pos.X, 0, hrp.Position.Z - s.pos.Z)
					away = (away.Magnitude > 0.1) and away.Unit or Vector3.new(1, 0, 0)
					remote:FireClient(plr, "knock", away * LZ.KNOCK + Vector3.new(0, LZ.KNOCK * 0.4, 0))
				elseif not flying and d <= LZ.KNOCK_RADIUS then
					local away = Vector3.new(hrp.Position.X - s.pos.X, 0, hrp.Position.Z - s.pos.Z)
					away = (away.Magnitude > 0.1) and away.Unit or Vector3.new(1, 0, 0)
					remote:FireClient(plr, "knock", away * LZ.KNOCK * 0.7 + Vector3.new(0, LZ.KNOCK * 0.5, 0))
				end
			end
		end
	end
end

-- ===== шина: панель разработчика и проверка =====

Bus.serve("Weather", function(cmd, a, b)
	if cmd == "set" then
		local name = tostring(a)
		if name == "storm" then
			local target = (typeof(b) == "Vector3") and b or nil
			startStorm(target, target and WC.FRONT.DEV_ARRIVE or nil)
			firstCycle = false
		elseif name == "rain" then
			if not Clock.front() then
				return false, "дождь бывает только после грозы: weather storm"
			end
			State:SetAttribute("StormT1", now())
			Clock.invalidate()
			advance()
		elseif DUR[name] then
			-- ясно / облачно / радуга по команде: фронт (если был) сразу уходит
			if Clock.front() then
				State:SetAttribute("StormT1", now())
				State:SetAttribute("StormEnd", now())
				Clock.invalidate()
			end
			setWeather(name, WorldMath.duration(DUR[name], rng:NextNumber()))
		else
			return false, "погода: clear cloudy storm rain rainbow"
		end
		return true, current
	elseif cmd == "strike" then
		-- для проверки: удар в точку a (Vector3) через TELEGRAPH
		if typeof(a) == "Vector3" then
			local gy = groundBelow(a)
			local tStrike = now() + LZ.TELEGRAPH
			table.insert(pending, { t = tStrike, pos = a, groundY = gy })
			remote:FireAllClients("strike", a, gy, tStrike, rng:NextInteger(1, 1e6))
			return true
		end
		return false
	elseif cmd == "info" then
		local w, t0, t1 = Clock.weather()
		local c = Clock.frontCenter()
		return {
			weather = w,
			t0 = t0,
			t1 = t1,
			left = t1 - now(),
			front = c,
			life = Clock.stormLife(),
			jitter = Flows and Flows.jitter or nil,
			pending = #pending,
		}
	end
	return nil
end)

-- ===== главный цикл =====

local acc = 0
local rodAcc = 99
RunService.Heartbeat:Connect(function(dt)
	local t = now()

	-- исполнить ждущие удары (даже если гроза уже кончилась — предупреждение было)
	for i = #pending, 1, -1 do
		local s = pending[i]
		if t >= s.t then
			table.remove(pending, i)
			resolveStrike(s)
		end
	end

	acc += dt
	if acc < 0.2 then
		return
	end
	acc = 0

	-- смена погоды
	local T1 = State:GetAttribute("WeatherT1") or 0
	if t >= T1 then
		advance()
	end

	-- дрожь течений (та же формула у игроков)
	if Flows then
		Flows.jitter = Clock.jitter(t)
	end

	-- молнии
	rodAcc += 0.2
	if rodAcc > 5 then
		rodAcc = 0
		refreshRayFilter()
	end
	if Clock.lightningOn(t) and t >= nextStrike then
		nextStrike = t + rng:NextNumber(LZ.EVERY[1], LZ.EVERY[2])
		scheduleStrike()
	end
end)

]==])

put("StarterPlayerScripts/Archipelago/AmbientClient", "LocalScript", [==[
--!nonstrict
-- AmbientClient — звук мира: фоновые петли регионов (день/ночь, переход 3 с), ветер по высоте и скорости,
-- глухой гул под облачным морем (эквалайзер на SoundService.World), звуковые зоны по тегу ArchAmbientZone.
-- Только для тех, кто в мире: в старой игре и в матчах всё плавно гаснет.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local CollectionService = game:GetService("CollectionService")

local Arch = ReplicatedStorage:WaitForChild("Archipelago")
local ConfigF = Arch:WaitForChild("Config")
local FX = require(Arch:WaitForChild("WorldFX"))
local Ambience = require(ConfigF:WaitForChild("Ambience"))
local Clock = FX.Clock
local WorldMath = Clock.Math

local player = Players.LocalPlayer
local ORIGIN = Clock.ORIGIN
local group = FX.SoundGroup

-- ===== эквалайзер «под облаками» =====

local eq = group:FindFirstChild("ArchUnderEQ")
if not eq then
	eq = Instance.new("EqualizerSoundEffect")
	eq.Name = "ArchUnderEQ"
	eq.HighGain = 0
	eq.MidGain = 0
	eq.LowGain = 0
	eq.Enabled = false
	eq.Parent = group
end

-- ===== петли =====

local function newLoop(id, speed)
	if not id or id == 0 then
		return nil
	end
	local s = FX.sound(id, nil, { looped = true, volume = 0, speed = speed or 1 })
	return s
end

local loops = {} -- [ключ] = {sound, vol (текущая), target}
local function loopRec(key, id, speed)
	local rec = loops[key]
	if rec == nil then
		local s = newLoop(id, speed)
		rec = { sound = s, vol = 0, target = 0 }
		loops[key] = rec
	end
	return rec
end

local function drive(rec, dt: number, fade: number)
	if not rec or not rec.sound then
		return
	end
	local k = math.clamp(dt / math.max(fade, 0.05), 0, 1)
	rec.vol += (rec.target - rec.vol) * k
	if rec.vol < 0.003 and rec.target == 0 then
		rec.vol = 0
		if rec.sound.IsPlaying then
			rec.sound:Stop()
		end
		return
	end
	if not rec.sound.IsPlaying then
		rec.sound:Play()
	end
	rec.sound.Volume = rec.vol
end

-- регионы: две петли на регион (день/ночь)
for name, r in pairs(Ambience.REGIONS) do
	loopRec("day:" .. name, r.day)
	loopRec("night:" .. name, r.night)
end

local wind = loopRec("wind", Ambience.OK.WIND_LOOP)
local whistle = loopRec("whistle", Ambience.OK.WHISTLE_LOOP)
local hum = loopRec("undersea", Ambience.OK.HUM_LOOP, 0.6)

-- ===== зоны =====

local zones = {} -- [part] = rec

local function zoneOff(part)
	local rec = zones[part]
	if rec then
		rec.target = 0
	end
end

local function updateZones(cam: Vector3, nightK: number, active: boolean)
	local list = {}
	if active then
		for _, p in ipairs(CollectionService:GetTagged("ArchAmbientZone")) do
			if p:IsA("BasePart") then
				local radius = p:GetAttribute("Radius") or 60
				local d = (p.Position - cam).Magnitude
				if d < radius * Ambience.ZONE_REACH then
					local onlyNight = p:GetAttribute("Night") == true
					if not onlyNight or nightK > 0.5 then
						table.insert(list, { p = p, d = d, r = radius })
					end
				end
			end
		end
		table.sort(list, function(a, b)
			return a.d < b.d
		end)
	end
	local keep = {}
	for i = 1, math.min(#list, Ambience.ZONE_MAX) do
		local z = list[i]
		keep[z.p] = true
		local rec = zones[z.p]
		if not rec then
			local id = z.p:GetAttribute("SoundId")
			local s = nil
			if type(id) == "number" and id ~= 0 then
				s = FX.sound(id, z.p, { looped = true, volume = 0, range = z.r * 1.2, min = z.r * 0.3 })
			end
			rec = { sound = s, vol = 0, target = 0 }
			zones[z.p] = rec
		end
		rec.target = (z.p:GetAttribute("Volume") or 0.6)
	end
	for p in pairs(zones) do
		if not keep[p] then
			zoneOff(p)
		end
	end
end

CollectionService:GetInstanceRemovedSignal("ArchAmbientZone"):Connect(function(p)
	local rec = zones[p]
	if rec and rec.sound then
		rec.sound:Destroy()
	end
	zones[p] = nil
end)

-- ===== главный цикл =====

local region = nil
local regionAt = 0
local slowAt = 0
local nightK = 0
local stormI = 0

RunService.RenderStepped:Connect(function(dt)
	local active = FX.inWorld()
	local cam = FX.camPos()
	local now = os.clock()

	if now - slowAt > 0.5 then
		slowAt = now
		if active then
			local info = Clock.day()
			nightK = info.night
			stormI = Clock.stormAt(cam)
		else
			nightK, stormI = 0, 0
		end
		updateZones(cam, nightK, active)
	end
	if now - regionAt > 0.5 then
		regionAt = now
		region = active and Clock.regionAt(cam) or nil
	end

	local y = cam.Y - ORIGIN.Y
	local seaY = Ambience.UNDERSEA.SEA_Y
	local under = active and y < seaY

	-- регионы: день/ночь, только текущий (под облаками — тише)
	for name, r in pairs(Ambience.REGIONS) do
		local on = active and region == name
		local base = on and (r.volume or 0.5) * (under and 0.35 or 1) or 0
		loops["day:" .. name].target = base * (1 - nightK)
		loops["night:" .. name].target = base * nightK
	end

	-- ветер: выше — громче; в грозу сильнее
	local W = Ambience.WIND
	local hk = WorldMath.smooth(W.BASE_Y, W.TOP_Y, y)
	wind.target = active and (W.VOLUME[1] + (W.VOLUME[2] - W.VOLUME[1]) * hk + 0.3 * stormI) * (under and 0.3 or 1) or 0
	if wind.sound then
		wind.sound.PlaybackSpeed = W.PITCH[1] + (W.PITCH[2] - W.PITCH[1]) * hk
	end

	-- свист на скорости (по своему персонажу)
	local speed = 0
	local char = player.Character
	local hrp = char and char:FindFirstChild("HumanoidRootPart")
	if hrp then
		speed = hrp.AssemblyLinearVelocity.Magnitude
	end
	local sk = WorldMath.smooth(W.WHISTLE_SPEED, W.WHISTLE_SPEED * 1.8, speed)
	whistle.target = active and W.WHISTLE_VOLUME * sk or 0
	if whistle.sound then
		whistle.sound.PlaybackSpeed = 0.9 + 0.35 * sk
	end

	-- под облачным морем: гул и глухой звук
	hum.target = under and Ambience.UNDERSEA.HUM_VOLUME or 0
	local E = Ambience.UNDERSEA.EQ
	if under then
		eq.Enabled = true
		eq.HighGain += (E.High - eq.HighGain) * math.clamp(dt * 3, 0, 1)
		eq.MidGain += (E.Mid - eq.MidGain) * math.clamp(dt * 3, 0, 1)
		eq.LowGain += (E.Low - eq.LowGain) * math.clamp(dt * 3, 0, 1)
	elseif eq.Enabled then
		eq.HighGain += (0 - eq.HighGain) * math.clamp(dt * 3, 0, 1)
		eq.MidGain += (0 - eq.MidGain) * math.clamp(dt * 3, 0, 1)
		eq.LowGain += (0 - eq.LowGain) * math.clamp(dt * 3, 0, 1)
		if math.abs(eq.HighGain) < 0.5 then
			eq.Enabled = false
		end
	end

	local fade = Ambience.REGION_FADE
	for key, rec in pairs(loops) do
		local f = (key == "whistle") and 0.4 or ((key == "wind" or key == "undersea") and 1.2 or fade)
		drive(rec, dt, f)
	end
	for _, rec in pairs(zones) do
		drive(rec, dt, 1.5)
	end
end)
]==])

put("StarterPlayerScripts/Archipelago/BirdsClient", "LocalScript", [==[
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
]==])

put("StarterPlayerScripts/Archipelago/CreaturesClient", "LocalScript", [==[
--!nonstrict
-- CreaturesClient — небесные киты и облачные медузы у игрока.
-- Киты: место от времени сервера (у всех в одной точке), волна по телу, плавники, хвост, крен,
-- светящиеся полосы ночью, песня (слышно за SONG_RANGE), перенос игрока на спине, сад со страницей.
-- Медузы: стайки дрейфуют, пульсируют; прыжок на колокол подбрасывает (+70) и даёт +1 свет (сервер).

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local Arch = ReplicatedStorage:WaitForChild("Archipelago")
local ConfigF = Arch:WaitForChild("Config")
local FX = require(Arch:WaitForChild("WorldFX"))
local Life = require(ConfigF:WaitForChild("Life"))
local Creatures = require(ConfigF:WaitForChild("Creatures"))
local Ambience = require(ConfigF:WaitForChild("Ambience"))
local Movers = Arch:WaitForChild("Movers")
local Whales = require(Movers:WaitForChild("Whales"))
local Jellies = require(Movers:WaitForChild("Jellies"))
local Assets = Arch:WaitForChild("Assets")
local WhaleBuilder = require(Assets:WaitForChild("WhaleBuilder"))
local JellyBuilder = require(Assets:WaitForChild("JellyBuilder"))
local Clock = FX.Clock
local WorldMath = Clock.Math

local player = Players.LocalPlayer
local W = Life.WHALE
local J = Life.JELLY
local SONG_RANGE = (Creatures.WHALE and Creatures.WHALE.SONG_RANGE) or 1500
local BOUNCE = (Creatures.JELLY and Creatures.JELLY.BOUNCE) or 70

local folder = FX.localFolder("Creatures")
local remote = Arch:WaitForChild("Remotes"):WaitForChild("Creatures", 30)

-- ===== киты =====

local whales = {}
for i, w in ipairs(Whales.list) do
	whales[i] = { w = w, rig = nil, lastAt = -1, songIdx = nil, songK = 0, lastBack = nil }
end

local secretDone = false

local function mutePage(rig)
	if rig and rig.page then
		rig.page.Transparency = 1
		local em = rig.page:FindFirstChildOfClass("ParticleEmitter")
		if em then
			em.Enabled = false
		end
		if rig.pageHalo then
			rig.pageHalo.Transparency = 1
		end
	end
end

local function ensureRig(e)
	if not e.rig then
		e.rig = WhaleBuilder.build(e.w, folder)
		if e.rig.pageEntry then
			e.rig.pageEntry.offset = Whales.GARDEN_PAGE
		end
		if secretDone then
			mutePage(e.rig)
		end
		e.parts = {}
		for k, en in ipairs(e.rig.entries) do
			e.parts[k] = en.part
		end
		e.cfs = table.create(#e.parts)
	end
	if e.rig.model.Parent ~= folder then
		e.rig.model.Parent = folder
	end
	return e.rig
end

local function hideRig(e)
	if e.rig and e.rig.model.Parent then
		e.rig.model.Parent = nil
	end
end

local function poseWhale(e, t: number)
	local w, rig = e.w, e.rig
	local seg = {}
	local wave = W.WAVE_SPEED * t
	for i = 1, rig.seg do
		local cf = Whales.frameAt(w, t, rig.d[i])
		local ph = wave - i * W.WAVE_K
		local a = W.WAVE_AMP * rig.amp[i]
		seg[i] = cf * CFrame.new(0, a * math.sin(ph), 0) * CFrame.Angles(0.09 * rig.amp[i] * math.cos(ph), 0, 0)
	end
	local back = Whales.backAt(w, t)
	local finA = 0.32 + 0.28 * math.sin(t * 1.5 + w.index)
	local flukeA = 0.34 * math.sin(wave - (rig.seg + 1) * W.WAVE_K)
	for k, en in ipairs(rig.entries) do
		local base = (en.base == "back") and back or seg[en.base]
		local cf
		if en.anim == "fin" then
			cf = base * en.offset * CFrame.Angles(0, 0, -en.sign * finA) * en.loc
		elseif en.anim == "fluke" then
			cf = base * en.offset * CFrame.Angles(flukeA, 0, 0) * en.loc
		elseif en.anim == "page" then
			cf = base * en.offset * CFrame.new(0, 0.45 * math.sin(t * 2.1), 0) * CFrame.Angles(0.25, t * 0.9, 0)
		else
			cf = base * en.offset
		end
		e.cfs[k] = cf
	end
	workspace:BulkMoveTo(e.parts, e.cfs, Enum.BulkMoveMode.FireCFrameChanged)
	return back
end

-- песня: одинаковое расписание у всех (от времени сервера)
local function songPeriod(w)
	return (W.SONG_EVERY[1] + W.SONG_EVERY[2]) * 0.5 + w.index * 3
end

local function singWhale(e)
	local head = e.rig and e.rig.head
	if not head then
		return
	end
	local w = e.w
	local pitch = 0.92 + 0.07 * w.index
	if Ambience.WHALE_SONG and Ambience.WHALE_SONG ~= 0 then
		FX.sound(Ambience.WHALE_SONG, head, { volume = 1.3, speed = pitch, range = SONG_RANGE, min = 150, life = W.SONG_LEN + 2 })
	else
		local fb = Ambience.WHALE_SONG_FALLBACK
		local s = FX.sound(fb.id, head, { looped = true, volume = 0, speed = fb.speed * pitch, range = SONG_RANGE, min = 150 })
		if s then
			s:Play()
			local up = TweenService:Create(s, TweenInfo.new(W.SONG_LEN * 0.35, Enum.EasingStyle.Sine), { Volume = fb.volume })
			up:Play()
			-- протяжная «нота»: тон медленно плывёт
			TweenService:Create(
				s,
				TweenInfo.new(W.SONG_LEN, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut),
				{ PlaybackSpeed = fb.speed * pitch * 1.18 }
			):Play()
			task.delay(W.SONG_LEN * 0.6, function()
				if s.Parent then
					TweenService:Create(s, TweenInfo.new(W.SONG_LEN * 0.4, Enum.EasingStyle.Sine), { Volume = 0 }):Play()
				end
			end)
			task.delay(W.SONG_LEN + 0.2, function()
				s:Destroy()
			end)
		end
	end
	e.songT = os.clock()
end

local function updateSong(e, t: number, dist: number)
	local w = e.w
	local P = songPeriod(w)
	local idx = math.floor((t + w.index * 11) / P)
	if e.songIdx == nil then
		e.songIdx = idx
	end
	if idx ~= e.songIdx then
		e.songIdx = idx
		if dist < SONG_RANGE * 1.1 then
			singWhale(e)
		end
	end
	-- полосы ярче, пока кит поёт
	local k = 0
	if e.songT then
		local dt = os.clock() - e.songT
		if dt < W.SONG_LEN then
			k = math.sin(math.pi * dt / W.SONG_LEN)
		end
	end
	e.songK = k
end

local function updateStripes(nightK: number)
	for _, e in ipairs(whales) do
		if e.rig and e.rig.model.Parent then
			local tr = W.STRIPE_DAY + (0.05 - W.STRIPE_DAY) * nightK - 0.45 * e.songK
			tr = math.clamp(tr, 0, 1)
			for _, p in ipairs(e.rig.stripes) do
				p.Transparency = tr
			end
		end
	end
end

-- ===== езда на ките =====

local rideRay = RaycastParams.new()
rideRay.FilterType = Enum.RaycastFilterType.Include

local riding = nil -- запись кита, на котором стоим

local function standingOn(e, hrp: BasePart, hum: Humanoid): boolean
	local plat = e.rig and e.rig.platform
	if not plat or not plat.Parent then
		return false
	end
	rideRay.FilterDescendantsInstances = e.rig.rideParts or { plat }
	local reach = hum.HipHeight + hrp.Size.Y * 0.5 + W.RIDE_RAY
	local hit = workspace:Raycast(hrp.Position, Vector3.new(0, -reach, 0), rideRay)
	return hit ~= nil
end

-- ===== медузы =====

local jelly = {} -- [g][j] = rig
local jellyCd = {} -- ["g:j"] = os.clock() следующего подброса
for g in ipairs(Jellies.groups) do
	jelly[g] = {}
end

local function ensureGroup(g: number)
	local grp = Jellies.groups[g]
	local list = jelly[g]
	if #list == 0 then
		for j, item in ipairs(grp.items) do
			list[j] = JellyBuilder.build(item, folder)
		end
	end
	for _, r in ipairs(list) do
		if r.model.Parent ~= folder then
			r.model.Parent = folder
		end
	end
	return list
end

local function hideGroup(g: number)
	for _, r in ipairs(jelly[g]) do
		if r.model.Parent then
			r.model.Parent = nil
		end
	end
end

local function bounceFx(r, pos: Vector3)
	r.squash.v = -9 -- колокол сжимается и пружинит обратно
	FX.soundOr(Ambience.JELLY_BOUNCE, Ambience.JELLY_FALLBACK, pos, { range = 200, min = 15 })
	FX.burst(pos, r.bell.Color, 24, 22, 1.2, true)
	FX.ring(pos - Vector3.new(0, 1, 0), r.size * 0.4, r.size * 1.6, 0.45, r.bell.Color, 0.8, 0.6)
end

-- высота ног в этом и прошлом кадре: на скорости падения окно ±3 стад проскакивается за кадр,
-- поэтому проверяем весь отрезок пути ног
local feetNow, feetPrev = nil, nil
local feetHrp = nil
local jellySent = {} -- ["g:j"] = os.clock(), когда снова можно просить свет у сервера

local function tryBounce(g: number, j: number, r, top: Vector3, hrp: BasePart, _hum: Humanoid)
	local key = g .. ":" .. j
	local now = os.clock()
	if (jellyCd[key] or 0) > now or not feetNow then
		return
	end
	local lo = math.min(feetPrev or feetNow, feetNow)
	local hi = math.max(feetPrev or feetNow, feetNow)
	if hi < top.Y - 2.5 or lo > top.Y + 3 then
		return
	end
	local flat = Vector3.new(hrp.Position.X - top.X, 0, hrp.Position.Z - top.Z).Magnitude
	if flat > r.size * 0.55 + 1.6 then
		return
	end
	local v = hrp.AssemblyLinearVelocity
	if v.Y > 6 then
		return
	end
	jellyCd[key] = now + J.LOCAL_COOLDOWN
	FX.knock(Vector3.new(0, BOUNCE - v.Y, 0))
	bounceFx(r, top)
	if remote and (jellySent[key] or 0) <= now then
		jellySent[key] = now + J.COOLDOWN
		remote:FireServer("jelly", g, j)
	end
end

local function poseGroup(g: number, t: number, cam: Vector3, hrp: BasePart?, hum: Humanoid?, dt: number)
	local grp = Jellies.groups[g]
	local list = ensureGroup(g)
	local parts, cfs = {}, {}
	for j, r in ipairs(list) do
		local it = grp.items[j]
		local pos = Jellies.pos(g, j, t)
		local s = math.sin(t * 1.9 + it.ph)
		local sq = WorldMath.spring(r.squash, 0, 2.6, 0.28, dt)
		r.mesh.Scale = Vector3.new(1 + 0.06 * s - sq * 0.05, 1 - 0.09 * s + sq * 0.09, 1 + 0.06 * s - sq * 0.05)
		r.rimMesh.Scale = Vector3.new(1 + 0.08 * s - sq * 0.06, 1, 1 + 0.08 * s - sq * 0.06)
		local tilt = CFrame.Angles(0.12 * math.sin(t * 0.7 + it.ph), t * 0.15 + it.ph, 0.12 * math.cos(t * 0.6 + it.ph))
		local base = CFrame.new(pos) * tilt
		table.insert(parts, r.bell)
		table.insert(cfs, base)
		table.insert(parts, r.rim)
		table.insert(cfs, base * CFrame.new(0, -r.size * 0.16, 0))
		table.insert(parts, r.core)
		table.insert(cfs, base * CFrame.new(0, -r.size * 0.02 + 0.3 * s, 0))
		local d = (pos - cam).Magnitude
		r.light.Enabled = d < J.LIGHT_NEAR
		if d < J.NEAR then
			for k, tip in ipairs(r.tips) do
				local ph = tip.ph + t * 1.4
				tip.att.Position = tip.base
					+ Vector3.new(math.sin(ph) * r.size * 0.16, math.sin(ph * 1.7) * r.size * 0.06 - sq * 0.3, math.cos(ph * 0.8) * r.size * 0.16)
				r.beams[k].CurveSize0 = math.sin(ph * 1.2) * r.size * 0.3
			end
			if hrp and hum then
				tryBounce(g, j, r, pos + Vector3.new(0, r.size * 0.32, 0), hrp, hum)
			end
		end
	end
	workspace:BulkMoveTo(parts, cfs, Enum.BulkMoveMode.FireCFrameChanged)
end

-- ===== секрет на ките =====

local secretAsk = 0

local function checkSecret(hrp: BasePart)
	if secretDone or not remote then
		return
	end
	for _, e in ipairs(whales) do
		local page = e.rig and e.rig.page
		if page and page.Parent and page.Parent.Parent then
			if (page.Position - hrp.Position).Magnitude < 7 and os.clock() > secretAsk then
				secretAsk = os.clock() + 3
				remote:FireServer("whaleSecret")
			end
		end
	end
end

local function hidePage(silent: boolean)
	secretDone = true
	for _, e in ipairs(whales) do
		local rig = e.rig
		if rig and rig.page then
			if not silent then
				local pos = rig.page.Position
				FX.layers({
					{ id = Ambience.OK.CHOIR, speed = 1, volume = 0.9 },
					{ id = Ambience.OK.CHIME[1], speed = 1.2, volume = 0.8 },
				}, pos, { range = 300 })
				FX.burst(pos, Color3.fromRGB(255, 226, 150), 70, 30, 1.6, true)
				FX.ring(pos - Vector3.new(0, 2, 0), 2, 26, 0.8, Color3.fromRGB(255, 226, 150), 1, 0.8)
				FX.flash(Color3.fromRGB(255, 236, 200), 0.5, 0.8)
			end
			mutePage(rig)
		end
	end
end

if remote then
	remote.OnClientEvent:Connect(function(kind, _a, b)
		if kind == "jellyOk" then
			local hrp = FX.rootPart()
			if hrp then
				FX.sound(Ambience.OK.CHIME[2], nil, { volume = 0.45, speed = 1.5 })
				FX.burst(hrp.Position + Vector3.new(0, 2, 0), Color3.fromRGB(255, 240, 170), 16, 10, 0.8, true)
			end
		elseif kind == "secretOk" then
			hidePage(b == true)
		end
	end)
end

-- ===== главный цикл (до физики: площадка кита и игрок двигаются вместе) =====

local frame = 0
local lastT = workspace:GetServerTimeNow()

RunService.PreSimulation:Connect(function(dt)
	frame += 1
	local t = workspace:GetServerTimeNow()
	local inWorld = FX.inWorld()
	local cam = FX.camPos()
	local char = player.Character
	local hrp = char and char:FindFirstChild("HumanoidRootPart")
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	if hum and hum.Health <= 0 then
		hrp, hum = nil, nil
	end
	if not (hrp and hum) then
		riding = nil -- умер / перерождается: старая езда не тянет новое тело
	end

	if not inWorld then
		for _, e in ipairs(whales) do
			hideRig(e)
		end
		for g in ipairs(jelly) do
			hideGroup(g)
		end
		riding = nil
		lastT = t
		return
	end

	-- киты
	for _, e in ipairs(whales) do
		local head = Whales.headAt(e.w, t)
		local dist = (head - cam).Magnitude
		local charDist = hrp and (head - hrp.Position).Magnitude or math.huge
		if dist > W.HIDE and charDist > W.HIDE then
			hideRig(e)
			if riding == e then
				riding = nil
			end
		else
			ensureRig(e)
			local need = charDist < 400 -- рядом с персонажем — каждый шаг (езда)
				or dist < W.LOD[1]
				or (dist < W.LOD[2] and frame % 3 == 0)
				or (t - e.lastAt > 0.25)
			if need then
				local oldBack = e.lastBack
				local back = poseWhale(e, t)
				e.lastAt = t
				e.lastBack = back
				-- перенос: игрок стоял на площадке — сдвигаем его вместе с ней
				if riding == e and charDist >= 400 then
					riding = nil -- телепорт/возрождение далеко от кита
				end
				if riding == e and oldBack and hrp and charDist < 400 then
					hrp.CFrame = back * oldBack:Inverse() * hrp.CFrame
				end
				if hrp and hum and charDist < 400 then
					if standingOn(e, hrp, hum) then
						riding = e
					elseif riding == e then
						riding = nil
					end
				end
			end
			updateSong(e, t, dist)
		end
	end

	-- медузы (ноги: этот кадр и прошлый)
	if hrp and hum then
		if hrp ~= feetHrp then
			feetPrev = nil
			feetHrp = hrp
		end
		feetNow = hrp.Position.Y - (hum.HipHeight + hrp.Size.Y * 0.5)
		if feetPrev and math.abs(feetNow - feetPrev) > 40 then
			feetPrev = nil -- телепорт
		end
	else
		feetNow, feetPrev, feetHrp = nil, nil, nil
	end
	for g, grp in ipairs(Jellies.groups) do
		local d = (grp.center - cam).Magnitude
		if d < J.NEAR * 2.5 + grp.radius then
			poseGroup(g, t, cam, hrp, hum, math.min(t - lastT, 0.1))
		else
			hideGroup(g)
		end
	end

	if hrp then
		checkSecret(hrp)
	end
	feetPrev = feetNow

	if frame % 30 == 0 then
		updateStripes(Clock.day(t).night)
	end
	lastT = t
end)
]==])

put("StarterPlayerScripts/Archipelago/GuardianClient", "LocalScript", [==[
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
	-- обломки без столкновений (не толкают игроков), поэтому «кладём» их на пол сами
	local floorY = attr("GFloor") or (center.Y - 14)
	local rest
	rest = RunService.Heartbeat:Connect(function()
		local moving = false
		for _, p in ipairs(rig.parts) do
			if p.Parent and not p.Anchored then
				if p.AssemblyLinearVelocity.Y < 0 and p.Position.Y - p.Size.Y * 0.5 <= floorY then
					p.Anchored = true
					p.Position = Vector3.new(p.Position.X, floorY + p.Size.Y * 0.5, p.Position.Z)
				else
					moving = true
				end
			end
		end
		if not moving then
			rest:Disconnect()
		end
	end)
	task.delay(4, function()
		if rest.Connected then
			rest:Disconnect()
		end
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
]==])

put("StarterPlayerScripts/Archipelago/NightClient", "LocalScript", [==[
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
]==])

put("StarterPlayerScripts/Archipelago/WeatherClient", "LocalScript", [==[
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
]==])

if rec then
	ChangeHistoryService:FinishRecording(rec, Enum.FinishRecordingOperation.Commit)
end
print(string.format("[stage4] готово: новых %d, обновлено %d (всего 27)", made, updated))

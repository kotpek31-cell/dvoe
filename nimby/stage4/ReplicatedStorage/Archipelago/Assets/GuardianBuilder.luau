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

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

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

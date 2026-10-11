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
	rideRay.FilterDescendantsInstances = { plat }
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

local function tryBounce(g: number, j: number, r, top: Vector3, hrp: BasePart, hum: Humanoid)
	local key = g .. ":" .. j
	local now = os.clock()
	if (jellyCd[key] or 0) > now then
		return
	end
	local feet = hrp.Position.Y - (hum.HipHeight + hrp.Size.Y * 0.5)
	local dy = feet - top.Y
	if dy < -2.5 or dy > 3 then
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
	if remote then
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

	-- медузы
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

	if frame % 30 == 0 then
		updateStripes(Clock.day(t).night)
	end
	lastT = t
end)

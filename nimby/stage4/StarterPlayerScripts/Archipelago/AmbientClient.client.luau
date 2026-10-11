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

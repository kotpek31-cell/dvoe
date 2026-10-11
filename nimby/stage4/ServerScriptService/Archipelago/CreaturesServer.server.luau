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

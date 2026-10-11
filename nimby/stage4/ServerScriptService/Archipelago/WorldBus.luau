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

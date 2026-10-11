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

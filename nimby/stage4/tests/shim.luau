-- минимальные заглушки Roblox для запуска чистых модулей вне Studio
local V = {}
V.__index = V
V.__add = function(a, b) return setmetatable({ X = a.X + b.X, Y = a.Y + b.Y, Z = a.Z + b.Z }, V) end
V.__sub = function(a, b) return setmetatable({ X = a.X - b.X, Y = a.Y - b.Y, Z = a.Z - b.Z }, V) end
V.__mul = function(a, b)
	if type(a) == "number" then a, b = b, a end
	return setmetatable({ X = a.X * b, Y = a.Y * b, Z = a.Z * b }, V)
end
local Vector3 = { new = function(x, y, z) return setmetatable({ X = x or 0, Y = y or 0, Z = z or 0 }, V) end }
local Color3 = { fromRGB = function(r, g, b) return { r, g, b } end, new = function(r, g, b) return { r, g, b } end }
return { Vector3 = Vector3, Color3 = Color3 }

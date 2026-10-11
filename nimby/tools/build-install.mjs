// Собирает nimby/stage4/install.luau — один скрипт для Studio (Command Bar или execute_luau),
// который ставит все новые файлы этапа 4 по местам. node nimby/tools/build-install.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const stage = path.resolve(here, "../stage4");
const ROOTS = ["ReplicatedStorage", "ServerScriptService", "StarterPlayerScripts"];

function classOf(f) {
  if (f.endsWith(".server.luau")) return "Script";
  if (f.endsWith(".client.luau")) return "LocalScript";
  return "ModuleScript";
}
function nameOf(f) {
  return f.replace(/\.(server|client)\.luau$/, "").replace(/\.luau$/, "");
}

const files = [];
function walk(dir, rel) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, [...rel, e.name]);
    else if (e.name.endsWith(".luau")) files.push({ full, inst: [...rel, nameOf(e.name)].join("/"), cls: classOf(e.name) });
  }
}
for (const r of ROOTS) walk(path.join(stage, r), [r]);

// модули раньше скриптов
files.sort((a, b) => (a.cls === "ModuleScript" ? 0 : 1) - (b.cls === "ModuleScript" ? 0 : 1));

function longString(src) {
  let n = 2;
  while (src.includes("]" + "=".repeat(n) + "]")) n++;
  const eq = "=".repeat(n);
  return `[${eq}[\n${src}]${eq}]`;
}

let out = `--!nonstrict
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

`;
for (const f of files) {
  const src = fs.readFileSync(f.full, "utf8");
  out += `put(${JSON.stringify(f.inst)}, ${JSON.stringify(f.cls)}, ${longString(src)})\n\n`;
}
out += `if rec then
	ChangeHistoryService:FinishRecording(rec, Enum.FinishRecordingOperation.Commit)
end
print(string.format("[stage4] готово: новых %d, обновлено %d (всего ${files.length})", made, updated))
`;
fs.writeFileSync(path.join(stage, "install.luau"), out);
console.log(`install.luau: ${files.length} файлов, ${(out.length / 1024).toFixed(0)} КБ`);
for (const f of files) console.log(`  ${f.cls.padEnd(12)} ${f.inst}`);

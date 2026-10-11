// Строит Rojo-подобный sourcemap для luau-lsp: файлы этапа 4 + заглушки (_stubs) + известные папки плейса.
// node nimby/tools/sourcemap.mjs > /tmp/sm.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const stage = path.resolve(here, "../stage4");
const SERVICES = new Set([
  "ReplicatedStorage",
  "ServerScriptService",
  "ServerStorage",
  "StarterPlayer",
  "SoundService",
  "Workspace",
]);

const root = { name: "Game", className: "DataModel", children: [] };

function child(node, name, className) {
  node.children ??= [];
  let c = node.children.find((x) => x.name === name);
  if (!c) {
    c = { name, className, children: [] };
    node.children.push(c);
  }
  return c;
}

function classOf(file) {
  if (file.endsWith(".server.luau")) return "Script";
  if (file.endsWith(".client.luau")) return "LocalScript";
  return "ModuleScript";
}
function nameOf(file) {
  return file.replace(/\.(server|client)\.luau$/, "").replace(/\.luau$/, "");
}

function walk(dir, node) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "_stubs" || e.name === "patches" || e.name === "tests") continue;
      let target;
      if (node === root && SERVICES.has(e.name)) target = child(root, e.name, e.name);
      else if (e.name === "StarterPlayerScripts") target = child(node, e.name, "StarterPlayerScripts");
      else target = child(node, e.name, "Folder");
      walk(full, target);
    } else if (e.name.endsWith(".luau")) {
      const c = child(node, nameOf(e.name), classOf(e.name));
      c.filePaths = [full];
    }
  }
}

// StarterPlayerScripts лежит в StarterPlayer
function walkStage(base) {
  for (const e of fs.readdirSync(base, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const full = path.join(base, e.name);
    if (e.name === "StarterPlayerScripts") {
      const sp = child(root, "StarterPlayer", "StarterPlayer");
      walk(full, child(sp, "StarterPlayerScripts", "StarterPlayerScripts"));
    } else if (SERVICES.has(e.name)) {
      walk(full, child(root, e.name, e.name));
    }
  }
}

walkStage(path.join(stage, "_stubs"));
walkStage(stage);

// известные экземпляры плейса без исходников
const arch = child(child(root, "ReplicatedStorage", "ReplicatedStorage"), "Archipelago", "Folder");
child(arch, "WorldState", "Folder");
const remotes = child(arch, "Remotes", "Folder");
for (const r of ["Flight", "DevPanel", "Progress", "Weather", "Creatures", "Guardian"]) child(remotes, r, "RemoteEvent");
child(arch, "Movers", "Folder");
child(arch, "Assets", "Folder");
const ws = child(root, "Workspace", "Workspace");
const warch = child(ws, "Archipelago", "Folder");
for (const f of ["Islands", "Silhouettes", "Currents", "Updrafts", "Beacons", "Altars", "Shards", "Lore", "Secrets"]) child(warch, f, "Folder");
child(root, "Players", "Players");
child(root, "Lighting", "Lighting");

process.stdout.write(JSON.stringify(root, null, 1));

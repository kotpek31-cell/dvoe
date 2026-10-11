#!/usr/bin/env bash
# Тесты чистой логики: конфиги с Vector3/Color3 копируются с заглушками Roblox, затем luau tests/run.luau
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
LUAU="${LUAU:-/tmp/claude-0/tools/luau-lsp/luau/build/luau}"
mkdir -p "$HERE/_gen"
for f in Life; do
  { echo 'local shim = require("../shim"); local Vector3, Color3 = shim.Vector3, shim.Color3'; sed '1{/^--!/d}' "$HERE/../ReplicatedStorage/Archipelago/Config/$f.luau"; } > "$HERE/_gen/$f.luau"
done
cd "$HERE/.." && "$LUAU" tests/run.luau

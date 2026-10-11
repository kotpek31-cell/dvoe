#!/usr/bin/env bash
# Статический анализ этапа 4: luau-lsp + типы Roblox + заглушки контрактов.
# LSP=путь к luau-lsp, DEFS=globalTypes.d.luau (из репозитория JohnnyMorganz/luau-lsp, scripts/)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
LSP="${LSP:-/tmp/claude-0/tools/luau-lsp/build/luau-lsp}"
DEFS="${DEFS:-/tmp/claude-0/tools/luau-lsp/scripts/globalTypes.d.luau}"
SM="$(mktemp)"
node "$HERE/sourcemap.mjs" > "$SM"
cd "$HERE/../stage4"
FILES=$(find ReplicatedStorage ServerScriptService StarterPlayerScripts -name '*.luau' | sort)
"$LSP" analyze --platform roblox --sourcemap "$SM" --definitions "@roblox=$DEFS" $FILES

#!/usr/bin/env bash
# Строгий проход: копия файлов с --!strict, показываем только ошибки обращений к свойствам/методам Roblox
# (опечатки в именах свойств, неверные Enum) — остальной шум строгого режима отбрасываем.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
LSP="${LSP:-/tmp/claude-0/tools/luau-lsp/build/luau-lsp}"
DEFS="${DEFS:-/tmp/claude-0/tools/luau-lsp/scripts/globalTypes.d.luau}"
TMP="$(mktemp -d)"
cp -r "$HERE/../stage4" "$TMP/stage4"
cp -r "$HERE" "$TMP/tools"
find "$TMP/stage4" -name '*.luau' -exec sed -i '1s/^--!nonstrict/--!strict/' {} +
SM="$(mktemp)"
node "$TMP/tools/sourcemap.mjs" > "$SM"
cd "$TMP/stage4"
FILES=$(find ReplicatedStorage ServerScriptService StarterPlayerScripts -name '*.luau' | sort)
"$LSP" analyze --platform roblox --sourcemap "$SM" --definitions "@roblox=$DEFS" $FILES 2>&1 \
  | grep -E "not found in external type|Unknown global|read-only|cannot be (assigned|written)" \
  | sed -E "s#^/[^ ]*/stage4/##; s#\\[game/[^]]*\\]##"

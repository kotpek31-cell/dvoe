local P = {}
P.ATTR = { cosmetics = "ArchCosmetics", shards = "ArchShards", lore = "ArchLore", secrets = "ArchSecrets" }
function P.set(plr: Player, key: string): { [string]: boolean }
	return {}
end
function P.encode(set: { [string]: boolean }): string
	return ""
end
return P

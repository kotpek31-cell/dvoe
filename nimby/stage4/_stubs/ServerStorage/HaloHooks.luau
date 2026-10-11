local H = {}
H.worldFrozen = false
H.voidWorld = false
H.decoys = {} :: { [Model]: { hrp: BasePart, hum: Humanoid, owner: Player? } }
function H.damage(hum: Humanoid, amount: number, attacker: Instance?): boolean
	return true
end
function H.canAttack(plr: Player): boolean
	return true
end
return H

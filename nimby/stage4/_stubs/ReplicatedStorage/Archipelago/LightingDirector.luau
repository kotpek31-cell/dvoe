local D = {}
function D.set(layer: string, props: { [string]: any }) end
function D.weight(layer: string, w: number, fade: number?) end
function D.clear(layer: string, fade: number?) end
function D.getWeight(layer: string): number
	return 0
end
function D.suspended(): boolean
	return false
end
return D

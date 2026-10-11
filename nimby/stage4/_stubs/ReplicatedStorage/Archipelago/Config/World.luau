local World = {}
World.ORIGIN = Vector3.new(0, 10, 0)
World.HUB_RADIUS = 620
World.EXCLUSION = {}
function World.regionAt(pos: Vector3): string?
	return nil
end
function World.inExclusion(pos: Vector3): boolean
	return false
end
return World

--!nonstrict
-- Config.WeatherCycle — погода (этап 4). Длительности — в Config.Weather (CLEAR, CLOUDY, STORM, RAINBOW),
-- там же CURRENT_JITTER, NO_STORM_REGIONS, SNOW_REGIONS. Здесь — веса переходов, фронт, молнии, свет.

local C3 = Color3.fromRGB

return {
	-- переходы: из погоды → {в погоду = вес}. Порядок случайный, с весами.
	WEIGHTS = {
		clear = { cloudy = 1 },
		cloudy = { storm = 0.65, clear = 0.35 },
		storm = { rain = 1 },
		rain = { rainbow = 0.7, clear = 0.3 },
		rainbow = { clear = 1 },
	},
	RAIN = 1.5, -- минут «дождь стихает» после грозы

	-- после запуска сервера: короткое ясно → облачно → обязательная гроза
	-- (проверка «за 24 минуты — хотя бы одна гроза»)
	FIRST_CLEAR = 6, -- минут
	FIRST_STORM = true,

	-- фронт грозы: стена облаков идёт через часть мира по прямой
	FRONT = {
		SPEED = { 14, 22 }, -- стад/с
		WIDTH = { 2400, 3200 }, -- поперёк хода
		DEPTH = { 900, 1300 }, -- вдоль хода
		EDGE = 500, -- мягкий край силы
		TOP = 1700, -- выше (от ORIGIN.Y) гроза слабеет до нуля за 500
		RAMP_IN = 40, -- с, нарастание
		-- куда целиться (смещения от ORIGIN — примерные центры регионов; север = +Z)
		TARGETS = {
			nest = { pos = Vector3.new(0, 0, 0), w = 1 },
			meadow = { pos = Vector3.new(0, 0, -3700), w = 3 },
			temple = { pos = Vector3.new(4500, 0, 0), w = 2 },
			ice = { pos = Vector3.new(0, 0, 5200), w = 2 },
			roots = { pos = Vector3.new(-3200, 0, 3200), w = 2 },
		},
		SPREAD = 1100, -- разброс точки цели
		TRIES = 40, -- попыток найти путь мимо исключённых зон и Кузницы
		DEV_ARRIVE = 20, -- с, через сколько фронт дойдёт до игрока по команде панели `weather storm`
	},

	-- молнии
	LIGHTNING = {
		EVERY = { 1.6, 3.8 }, -- с между ударами внутри фронта
		TELEGRAPH = 0.95, -- с предупреждения (свечение в туче + треск + круг на земле)
		NEAR_FLYER = 0.45, -- доля ударов рядом с летящим игроком внутри грозы
		NEAR_DIST = { 14, 34 }, -- как близко к нему
		MIN_STORM = 0.55, -- сила грозы в точке, чтобы туда била молния
		BOLT_HEIGHT = 520, -- от точки удара до тучи
		STUN_RADIUS = 26, -- летящий ближе — крылья сложатся
		KNOCK_RADIUS = 18, -- стоящий ближе — толчок
		KNOCK = 75, -- сила толчка
		WHY = "lightning",
		SEA_Y = -500, -- если под точкой нет острова — бьёт в облачное море
	},

	-- порывы в грозе: иногда выбивают из течения (только у самого игрока)
	GUST = {
		MIN_STORM = 0.6,
		EVERY = { 7, 14 },
		CHANCE = 0.55,
		POWER = 58,
		SNOW_POWER = 72, -- в метели сильнее
	},

	-- осадки у камеры (частицы только у игрока)
	RAIN_FX = {
		RATE = 900, -- при полной силе; на слабой графике меньше
		SPEED = { 130, 160 },
		BOX = 170, -- размер коробки над камерой
		TEXTURE = "rbxasset://textures/particles/sparkles_main.dds", -- TODO(studio): найти капли/полосы
		COLOR = C3(190, 205, 235),
	},
	SNOW_FX = {
		RATE = 520,
		SPEED = { 18, 34 },
		BOX = 150,
		TEXTURE = "rbxasset://textures/particles/sparkles_main.dds", -- TODO(studio): найти снежинки
		COLOR = C3(240, 246, 255),
		WIND = 46, -- боковой снос
	},

	-- стена облаков (видна издалека)
	WALL = {
		COLS = 16,
		ROWS = { -420, -120, 200, 520, 860 }, -- высоты рядов от ORIGIN.Y
		PUFF = { 150, 290 }, -- размер облака
		COLOR = C3(62, 64, 92),
		COLOR_TOP = C3(110, 108, 140),
		FLASH = C3(196, 186, 255),
		NEAR_FADE = { 260, 520 }, -- облака ближе к камере растворяются
		SEA_FLASH = C3(170, 160, 255),
	},

	-- свет погоды (слой weather). Без Grade.TintColor (он у вспышек).
	LIGHT = {
		cloudy = {
			["Lighting.Brightness"] = 1.6,
			["Lighting.OutdoorAmbient"] = C3(126, 130, 146),
			["Atmosphere.Density"] = 0.38,
			["Atmosphere.Haze"] = 2.2,
			["Atmosphere.Glare"] = 0,
			["Atmosphere.Color"] = C3(170, 178, 196),
			["Grade.Saturation"] = -0.12,
			["Grade.Contrast"] = 0.02,
			["SunRays.Intensity"] = 0.02,
		},
		storm = {
			["Lighting.Brightness"] = 0.8,
			["Lighting.OutdoorAmbient"] = C3(70, 74, 98),
			["Atmosphere.Density"] = 0.52,
			["Atmosphere.Haze"] = 3.2,
			["Atmosphere.Glare"] = 0,
			["Atmosphere.Color"] = C3(84, 90, 116),
			["Atmosphere.Decay"] = C3(40, 40, 64),
			["Grade.Saturation"] = -0.32,
			["Grade.Contrast"] = 0.12,
			["Grade.Brightness"] = -0.04,
			["SunRays.Intensity"] = 0,
		},
		snow = {
			["Lighting.Brightness"] = 1.4,
			["Lighting.OutdoorAmbient"] = C3(170, 182, 210),
			["Atmosphere.Density"] = 0.62,
			["Atmosphere.Haze"] = 3.6,
			["Atmosphere.Glare"] = 0,
			["Atmosphere.Color"] = C3(214, 224, 244),
			["Atmosphere.Decay"] = C3(160, 176, 214),
			["Grade.Saturation"] = -0.2,
			["Grade.Contrast"] = -0.04,
			["Grade.Brightness"] = 0.05,
			["SunRays.Intensity"] = 0,
		},
		CLOUDY_WEIGHT = 0.55, -- вес слоя в облачную погоду по всему миру
		FADE = 0.6, -- с
		FLASH_BRIGHTNESS = 3.2, -- прибавка к Lighting.Brightness в момент молнии (рядом)
	},

	-- радуга после дождя (у игрока, напротив солнца)
	RAINBOW = {
		DIST = 900,
		RADIUS = 620,
		BAND = 22,
		COLORS = { C3(255, 70, 70), C3(255, 150, 60), C3(255, 230, 80), C3(90, 230, 110), C3(70, 170, 255), C3(90, 90, 230), C3(170, 90, 230) },
		ALPHA = 0.45, -- прозрачность в пике (0 — сплошная)
	},
}

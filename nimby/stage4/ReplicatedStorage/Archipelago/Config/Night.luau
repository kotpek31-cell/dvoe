--!nonstrict
-- Config.Night — сутки и ночь (этап 4). Длины фаз — в Config.Day.PHASES (не дублировать).
-- Свет суток идёт слоем "daynight" через LightingDirector (NightClient). Lighting.ClockTime напрямую не писать.

local C3 = Color3.fromRGB

return {
	-- с какой фазы начинаются сутки при запуске сервера (проверка «за 24 минуты — полные сутки»)
	START_PHASE = "day",

	-- часы Roblox для каждой фазы: {начало, конец}; конец может быть > 24 (ночь переходит через полночь)
	CLOCK = {
		dawn = { 5.0, 7.0 },
		day = { 7.0, 17.0 },
		sunset = { 17.0, 19.0 },
		night = { 19.0, 28.5 },
		predawn = { 4.5, 5.0 },
	},

	-- как часто слой daynight обновляет свет (с); ClockTime смешивается директором по кругу
	TICK = 1 / 15,

	-- ключевые кадры света по часам (между ними — плавно). Только слой daynight.
	-- Grade.TintColor НЕ писать: он отдан вспышкам WorldFX (слой fx).
	KEYS = {
		{ 0.0, {
			["Lighting.Brightness"] = 0.9,
			["Lighting.Ambient"] = C3(34, 34, 62),
			["Lighting.OutdoorAmbient"] = C3(58, 62, 112),
			["Lighting.ColorShift_Top"] = C3(110, 130, 220),
			["Lighting.ExposureCompensation"] = 0.15,
			["Atmosphere.Color"] = C3(62, 72, 130),
			["Atmosphere.Decay"] = C3(28, 26, 64),
			["Atmosphere.Density"] = 0.34,
			["Atmosphere.Haze"] = 1.4,
			["Atmosphere.Glare"] = 0,
			["Bloom.Intensity"] = 1.1,
			["SunRays.Intensity"] = 0,
		} },
		{ 5.2, {
			["Lighting.Brightness"] = 1.2,
			["Lighting.Ambient"] = C3(60, 48, 78),
			["Lighting.OutdoorAmbient"] = C3(118, 92, 132),
			["Lighting.ColorShift_Top"] = C3(200, 140, 180),
			["Lighting.ExposureCompensation"] = 0.1,
			["Atmosphere.Color"] = C3(170, 120, 170),
			["Atmosphere.Decay"] = C3(80, 60, 120),
			["Atmosphere.Density"] = 0.36,
			["Atmosphere.Haze"] = 2.0,
			["Atmosphere.Glare"] = 0.3,
			["Bloom.Intensity"] = 0.9,
			["SunRays.Intensity"] = 0.05,
		} },
		{ 6.3, {
			["Lighting.Brightness"] = 2.0,
			["Lighting.Ambient"] = C3(96, 80, 90),
			["Lighting.OutdoorAmbient"] = C3(170, 130, 130),
			["Lighting.ColorShift_Top"] = C3(255, 178, 130),
			["Lighting.ExposureCompensation"] = 0.05,
			["Atmosphere.Color"] = C3(255, 178, 150),
			["Atmosphere.Decay"] = C3(150, 96, 130),
			["Atmosphere.Density"] = 0.34,
			["Atmosphere.Haze"] = 2.4,
			["Atmosphere.Glare"] = 0.9,
			["Bloom.Intensity"] = 0.75,
			["SunRays.Intensity"] = 0.18,
		} },
		{ 8.5, {
			["Lighting.Brightness"] = 2.8,
			["Lighting.Ambient"] = C3(112, 112, 128),
			["Lighting.OutdoorAmbient"] = C3(146, 146, 158),
			["Lighting.ColorShift_Top"] = C3(255, 244, 226),
			["Lighting.ExposureCompensation"] = 0,
			["Atmosphere.Color"] = C3(196, 220, 255),
			["Atmosphere.Decay"] = C3(104, 134, 186),
			["Atmosphere.Density"] = 0.3,
			["Atmosphere.Haze"] = 1.1,
			["Atmosphere.Glare"] = 0.25,
			["Bloom.Intensity"] = 0.6,
			["SunRays.Intensity"] = 0.1,
		} },
		{ 15.6, {
			["Lighting.Brightness"] = 2.7,
			["Lighting.Ambient"] = C3(116, 110, 122),
			["Lighting.OutdoorAmbient"] = C3(150, 142, 150),
			["Lighting.ColorShift_Top"] = C3(255, 236, 210),
			["Lighting.ExposureCompensation"] = 0,
			["Atmosphere.Color"] = C3(206, 218, 250),
			["Atmosphere.Decay"] = C3(112, 130, 180),
			["Atmosphere.Density"] = 0.3,
			["Atmosphere.Haze"] = 1.2,
			["Atmosphere.Glare"] = 0.3,
			["Bloom.Intensity"] = 0.62,
			["SunRays.Intensity"] = 0.12,
		} },
		{ 17.9, {
			["Lighting.Brightness"] = 2.1,
			["Lighting.Ambient"] = C3(108, 78, 92),
			["Lighting.OutdoorAmbient"] = C3(178, 118, 120),
			["Lighting.ColorShift_Top"] = C3(255, 136, 84),
			["Lighting.ExposureCompensation"] = 0.05,
			["Atmosphere.Color"] = C3(255, 150, 118),
			["Atmosphere.Decay"] = C3(150, 64, 120),
			["Atmosphere.Density"] = 0.35,
			["Atmosphere.Haze"] = 2.7,
			["Atmosphere.Glare"] = 1.4,
			["Bloom.Intensity"] = 0.85,
			["SunRays.Intensity"] = 0.24,
		} },
		{ 19.4, {
			["Lighting.Brightness"] = 1.1,
			["Lighting.Ambient"] = C3(52, 42, 84),
			["Lighting.OutdoorAmbient"] = C3(82, 70, 130),
			["Lighting.ColorShift_Top"] = C3(150, 110, 220),
			["Lighting.ExposureCompensation"] = 0.12,
			["Atmosphere.Color"] = C3(110, 86, 160),
			["Atmosphere.Decay"] = C3(50, 34, 90),
			["Atmosphere.Density"] = 0.35,
			["Atmosphere.Haze"] = 1.8,
			["Atmosphere.Glare"] = 0.2,
			["Bloom.Intensity"] = 1.0,
			["SunRays.Intensity"] = 0.02,
		} },
	},

	-- светлячки (ночь): над островами этих регионов + детали с тегом ArchFireflies
	FIREFLIES = {
		REGIONS = { meadow = true, roots = true },
		RANGE = 700, -- дальше от камеры не горят
		MAX_ISLANDS = 6,
		RATE = 9, -- в секунду на остров при полной ночи
		COLOR = { C3(255, 236, 120), C3(190, 255, 150) },
	},

	-- окна руин и фонари (теги ArchNightGlow / ArchNightLight)
	GLOW = {
		DEFAULT = C3(255, 196, 120),
		ON_AT = 0.45, -- ночной коэффициент, с которого окна переключаются в Neon
	},

	-- созвездия-подсказки к финалу: направление на небе (азимут, высота в градусах) и звёзды (x, y в «ячейках» 0..10)
	-- линии — пары номеров звёзд. Видны ночью, ярче на высоте.
	SKY = {
		DIST = 1600, -- как далеко висят (BillboardGui, на туман не влияет)
		SIZE = 520, -- размер созвездия, стад
		COLOR = C3(205, 225, 255),
		LINE = C3(150, 190, 255),
		CONSTELLATIONS = {
			{ name = "Нимб", az = 20, el = 55, stars = { { 2, 5 }, { 3.5, 7.4 }, { 6.5, 7.4 }, { 8, 5 }, { 6.5, 2.6 }, { 3.5, 2.6 } }, lines = { { 1, 2 }, { 2, 3 }, { 3, 4 }, { 4, 5 }, { 5, 6 } } },
			{ name = "Кит", az = 110, el = 38, stars = { { 1, 5 }, { 3, 6.5 }, { 5.5, 6.8 }, { 8, 5.6 }, { 9.4, 7.2 }, { 9.4, 3.8 }, { 5, 4 } }, lines = { { 1, 2 }, { 2, 3 }, { 3, 4 }, { 4, 5 }, { 4, 6 }, { 1, 7 }, { 7, 4 } } },
			{ name = "Великан", az = 200, el = 48, stars = { { 5, 9 }, { 5, 7 }, { 2.5, 6.4 }, { 7.5, 6.4 }, { 5, 4.2 }, { 3.6, 1 }, { 6.4, 1 } }, lines = { { 1, 2 }, { 2, 3 }, { 2, 4 }, { 2, 5 }, { 5, 6 }, { 5, 7 } } },
			{ name = "Ключ", az = 290, el = 32, stars = { { 1.5, 5 }, { 3, 6.4 }, { 3, 3.6 }, { 4.5, 5 }, { 9, 5 }, { 9, 3.4 }, { 7.5, 5 }, { 7.5, 3.8 } }, lines = { { 1, 2 }, { 2, 4 }, { 4, 3 }, { 3, 1 }, { 4, 5 }, { 5, 6 }, { 7, 8 } } },
			{ name = "Сердце неба", az = 0, el = 82, stars = { { 5, 2 }, { 2.4, 5 }, { 3.2, 7.4 }, { 5, 6.2 }, { 6.8, 7.4 }, { 7.6, 5 } }, lines = { { 1, 2 }, { 2, 3 }, { 3, 4 }, { 4, 5 }, { 5, 6 }, { 6, 1 } } },
		},
	},

	-- северное сияние над Ледяным венцом (север = +Z). Смещение от ORIGIN.
	AURORA = {
		CENTER = Vector3.new(0, 1850, 5600),
		SPAN = 4200, -- ширина занавеса по X
		CURTAINS = 3,
		POINTS = 9, -- точек на занавес
		HEIGHT = 420, -- высота ленты
		COLORS = { C3(80, 255, 170), C3(60, 220, 255), C3(170, 110, 255) },
		DUSK = 0.25, -- немного видно и в сумерках
	},

	-- закатный остров (тег ArchSunsetOnly): виден только в фазе sunset
	SUNSET = {
		FADE = 3.5, -- с, проявление у игрока
		HIDDEN_FOLDER = "ArchSunsetHidden",
	},
}

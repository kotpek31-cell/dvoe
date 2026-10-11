--!nonstrict
-- Config.Ambience — все звуки этапа 4. 0 = звука нет: «найти в Studio» (Creator Store), найденный ID
-- сразу дописать в скилл «Нимбов». Проверенные ID — те же, что в Config.Flight.SND.

return {
	-- проверенные (из Config.Flight.SND)
	OK = {
		WIND_LOOP = 5113213873,
		WHISTLE_LOOP = 687874741,
		HUM_LOOP = 9112795571,
		WHOOSH = { 90661028523798, 9125647212, 9125646712 },
		CHIME = { 9116394545, 9116395089 },
		CHOIR = 121538758381608,
		FLAP = { 9120778367, 9120779671 },
		BOOM = 1835337001, -- boom
		BOOM_B = 9039916716, -- boomB
		FALL = { 9113475819, 9113473249 },
	},

	-- киты
	WHALE_SONG = 0, -- найти в Studio: низкая протяжная песня кита
	-- пока песни нет — гул-петля, очень низко (временно)
	WHALE_SONG_FALLBACK = { id = 9112795571, speed = 0.3, volume = 1.4 },

	-- медузы
	JELLY_BOUNCE = 0, -- найти в Studio: «бульк-звон»
	JELLY_FALLBACK = { { id = 9116394545, speed = 1.45, volume = 0.6 }, { id = 9120779671, speed = 1.8, volume = 0.35 } },

	-- погода
	THUNDER = 0, -- найти в Studio: раскат грома
	-- временно: boom + boomB с понижением
	THUNDER_FALLBACK = { { id = 1835337001, speed = 0.55, volume = 1.3 }, { id = 9039916716, speed = 0.7, volume = 1.0 } },
	CRACKLE = 0, -- найти в Studio: треск перед ударом молнии
	RAIN_LOOP = 0, -- найти в Studio: дождь-петля
	BLIZZARD_LOOP = 0, -- найти в Studio: метель-петля
	STORM_WIND_FALLBACK = { id = 687874741, speed = 0.72, volume = 0.55 }, -- пока нет дождя/метели

	-- птицы
	BIRDS_CHIRP = 0, -- найти в Studio: щебет-искорки
	BIRDS_SCATTER = { id = 9116395089, speed = 1.6, volume = 0.5 }, -- разлёт: звон

	-- регионы: фоновые петли (день / ночь). Переход 3 с (Config.Sky.REGION_FADE).
	REGIONS = {
		nest = { day = 0, night = 0, volume = 0.45 }, -- найти: тёплый ветер, далёкие колокольчики
		meadow = { day = 0, night = 0, volume = 0.5 }, -- найти: ветер в траве + колокольчики / сверчки ночью
		temple = { day = 0, night = 0, volume = 0.5 }, -- найти: эхо, хор вдалеке
		forge = { day = 0, night = 0, volume = 0.55 }, -- найти: гул горна, удары молота вдалеке
		ice = { day = 0, night = 0, volume = 0.55 }, -- найти: треск льда, вой ветра
		roots = { day = 0, night = 0, volume = 0.5 }, -- найти: шелест, скрип дерева
	},
	REGION_FADE = 3,

	-- ветер по высоте (проверенные петли): чем выше — тем громче
	WIND = {
		BASE_Y = -200, -- ниже этого (от ORIGIN.Y) ветер тихий
		TOP_Y = 1600, -- здесь ветер на максимуме
		VOLUME = { 0.12, 0.7 },
		PITCH = { 0.85, 1.15 },
		WHISTLE_SPEED = 90, -- с этой скорости (стад/с) слышен свист
		WHISTLE_VOLUME = 0.45,
	},

	-- под облачным морем всё глухо
	UNDERSEA = {
		SEA_Y = -500,
		HUM_VOLUME = 0.5,
		EQ = { High = -28, Mid = -10, Low = 2 },
	},

	-- звуковые зоны по тегу ArchAmbientZone: включаются ближе Radius × ZONE_REACH
	ZONE_REACH = 1.4,
	ZONE_MAX = 6,
}

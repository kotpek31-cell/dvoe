// Звуки способностей (assets/sounds, генерирует tools/sound/build.ts; mog.wav — голос)
export const SOUND_FILES = {
  mog: require('../../assets/sounds/mog.wav') as number,
  tension: require('../../assets/sounds/tension.wav') as number,
  hit: require('../../assets/sounds/hit.wav') as number,
  chime: require('../../assets/sounds/chime.wav') as number,
};

export type SoundName = keyof typeof SOUND_FILES;

// Фоновые звуки мест (0.2.1, генерирует tools/sound/ambient.ts): петля 24 с + 1 с её же начала
export const AMBIENT_FILES = {
  meadow: require('../../assets/sounds/amb_meadow.mp3') as number,
  aurora: require('../../assets/sounds/amb_aurora.mp3') as number,
  roof: require('../../assets/sounds/amb_roof.mp3') as number,
  beach: require('../../assets/sounds/amb_beach.mp3') as number,
  forest: require('../../assets/sounds/amb_forest.mp3') as number,
  snow: require('../../assets/sounds/amb_snow.mp3') as number,
  cafe: require('../../assets/sounds/amb_cafe.mp3') as number,
  moon: require('../../assets/sounds/amb_moon.mp3') as number,
  sakura: require('../../assets/sounds/amb_sakura.mp3') as number,
  rain: require('../../assets/sounds/amb_rain.mp3') as number,
  mountains: require('../../assets/sounds/amb_mountains.mp3') as number,
  cave: require('../../assets/sounds/amb_cave.mp3') as number,
};

export type AmbientId = keyof typeof AMBIENT_FILES;
export const AMBIENT_LOOP = 24; // длина петли, с
export const AMBIENT_START = 0.5; // веб крутит [0,5; 24,5] — шов ровно в период
export const AMBIENT_VOLUME = 0.35;

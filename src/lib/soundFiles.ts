// Звуки способностей (assets/sounds, генерирует tools/sound/build.ts; mog.wav — голос)
export const SOUND_FILES = {
  mog: require('../../assets/sounds/mog.wav') as number,
  tension: require('../../assets/sounds/tension.wav') as number,
  hit: require('../../assets/sounds/hit.wav') as number,
  chime: require('../../assets/sounds/chime.wav') as number,
};

export type SoundName = keyof typeof SOUND_FILES;

// Звуки способностей на телефоне (expo-audio). Android — на громкости медиа.
// Переключатель «Звуки способностей» в настройках; по умолчанию включены.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { getFlag, setFlag } from './prefs';
import { SOUND_FILES, type SoundName } from './soundFiles';

export type { SoundName };

let enabled = true;
getFlag('abilitySoundsOff').then((off) => {
  enabled = !off;
});

const players = new Map<SoundName, AudioPlayer>();
let modeSet = false;

function player(name: SoundName): AudioPlayer | null {
  try {
    if (!modeSet) {
      modeSet = true;
      setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(() => undefined);
    }
    let p = players.get(name);
    if (!p) {
      p = createAudioPlayer(SOUND_FILES[name]);
      players.set(name, p);
    }
    return p;
  } catch {
    return null;
  }
}

// Загрузить заранее, чтобы звук не опаздывал за сценой
export function prepareSounds(names: SoundName[]) {
  if (enabled) names.forEach(player);
}

export function playSound(name: SoundName, volume = 1) {
  if (!enabled) return;
  const p = player(name);
  if (!p) return;
  try {
    p.volume = volume;
    p.seekTo(0).catch(() => undefined);
    p.play();
  } catch {
    // без звука — не страшно
  }
}

export function stopSounds() {
  players.forEach((p) => {
    try {
      p.pause();
    } catch {
      // ничего
    }
  });
}

// На телефоне звук можно включать без касания
export const canAutoplay = () => true;

export const soundsEnabled = () => enabled;

export async function setSoundsEnabled(value: boolean) {
  enabled = value;
  if (!value) stopSounds();
  await setFlag('abilitySoundsOff', !value);
}

export async function loadSoundsEnabled(): Promise<boolean> {
  enabled = !(await getFlag('abilitySoundsOff'));
  return enabled;
}

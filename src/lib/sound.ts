// Звуки способностей на телефоне (expo-audio). Android — на громкости медиа.
// Переключатель «Звуки способностей» в настройках; по умолчанию включены.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { getFlag, setFlag } from './prefs';
import { AMBIENT_FILES, AMBIENT_VOLUME, SOUND_FILES, type AmbientId, type SoundName } from './soundFiles';

export type { AmbientId, SoundName };

let enabled = true;
getFlag('abilitySoundsOff').then((off) => {
  enabled = !off;
});

const players = new Map<SoundName, AudioPlayer>();
let modeSet = false;

function audioMode() {
  if (modeSet) return;
  modeSet = true;
  setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(() => undefined);
}

function player(name: SoundName): AudioPlayer | null {
  try {
    audioMode();
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

// Беззвучный режим iPhone — только в браузере (sound.web.ts); на Android звук идёт по громкости медиа
export const silentSwitchSupported = () => false;
export const loadQuietInSilent = async () => false;
export const setQuietInSilent = async (_value: boolean) => undefined;

// ---------- Фоновый звук места ----------
// Переключатель «Звуки места» в настройках; по умолчанию включены. Играет только на главной.
let ambientOn = true;
let wanted: AmbientId | null = null;
let amb: { id: AmbientId; p: AudioPlayer } | null = null;
getFlag('ambientOff').then((off) => {
  ambientOn = !off;
  if (!ambientOn) playAmbient(null, true);
});

export function playAmbient(id: AmbientId | null, keepWanted = false) {
  if (!keepWanted) wanted = id;
  if (amb && amb.id === id && ambientOn) return;
  if (amb) {
    try {
      amb.p.pause();
      amb.p.remove();
    } catch {
      // ничего
    }
    amb = null;
  }
  if (!id || !ambientOn) return;
  try {
    audioMode();
    const p = createAudioPlayer(AMBIENT_FILES[id]);
    p.loop = true;
    p.volume = AMBIENT_VOLUME;
    p.play();
    amb = { id, p };
  } catch {
    amb = null;
  }
}

export const ambientEnabled = () => ambientOn;

export async function setAmbientEnabled(value: boolean) {
  ambientOn = value;
  playAmbient(value ? wanted : null, true);
  await setFlag('ambientOff', !value);
}

export async function loadAmbientEnabled(): Promise<boolean> {
  ambientOn = !(await getFlag('ambientOff'));
  return ambientOn;
}

// Звуки способностей в браузере: Web Audio. Safari (iPhone) разрешает звук только после касания,
// поэтому контекст «будится» на первом касании; до него сцену запускают кнопкой «Смотреть».
// В беззвучном режиме iPhone звука не будет — так решает система.
import { Asset } from 'expo-asset';
import { getFlag, setFlag } from './prefs';
import { SOUND_FILES, type SoundName } from './soundFiles';

export type { SoundName };

let enabled = true;
getFlag('abilitySoundsOff').then((off) => {
  enabled = !off;
});

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let touched = false;
const buffers = new Map<SoundName, Promise<AudioBuffer | null>>();
const playing = new Set<AudioBufferSourceNode>();

function context(): Ctx | null {
  if (ctx) return ctx;
  const W = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctor = W.AudioContext ?? W.webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

function unlock() {
  touched = true;
  const c = context();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => undefined);
  // короткая тишина — iOS после этого разрешает звук
  try {
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, 22050);
    src.connect(c.destination);
    src.start(0);
  } catch {
    // ничего
  }
}

if (typeof window !== 'undefined') {
  const events = ['pointerdown', 'touchend', 'keydown'];
  const once = () => {
    unlock();
    events.forEach((e) => window.removeEventListener(e, once, true));
  };
  events.forEach((e) => window.addEventListener(e, once, true));
}

function load(name: SoundName): Promise<AudioBuffer | null> {
  let b = buffers.get(name);
  if (!b) {
    b = (async () => {
      const c = context();
      if (!c) return null;
      try {
        const uri = Asset.fromModule(SOUND_FILES[name]).uri;
        const data = await (await fetch(uri)).arrayBuffer();
        return await new Promise<AudioBuffer>((resolve, reject) => c.decodeAudioData(data, resolve, reject));
      } catch {
        buffers.delete(name);
        return null;
      }
    })();
    buffers.set(name, b);
  }
  return b;
}

export function prepareSounds(names: SoundName[]) {
  if (enabled) names.forEach((n) => load(n));
}

export function playSound(name: SoundName, volume = 1) {
  if (!enabled) return;
  const c = context();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => undefined);
  load(name).then((buf) => {
    if (!buf || !enabled) return;
    try {
      const src = c.createBufferSource();
      src.buffer = buf;
      const gain = c.createGain();
      gain.gain.value = volume;
      src.connect(gain).connect(c.destination);
      src.onended = () => playing.delete(src);
      playing.add(src);
      src.start(0);
    } catch {
      // без звука — не страшно
    }
  });
}

export function stopSounds() {
  playing.forEach((s) => {
    try {
      s.stop();
    } catch {
      // уже остановлен
    }
  });
  playing.clear();
}

// Можно ли запускать сцену со звуком без касания: после первого касания — да
export const canAutoplay = () => touched || !enabled;

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

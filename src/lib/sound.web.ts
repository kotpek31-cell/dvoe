// Звуки в браузере: Web Audio. Safari (iPhone) разрешает звук только из «настоящего» касания — touchend, click
// или клавиши (pointerdown от пальца не считается!), поэтому будим контекст на каждом таком событии, пока он не заработает,
// и снова — после ухода в фон (iOS «прерывает» звук). До первого касания сцену запускают кнопкой «Смотреть».
// Беззвучный режим iPhone: по умолчанию звук играет и в нём (audioSession 'playback'); переключатель в настройках.
import { Asset } from 'expo-asset';
import { getFlag, setFlag } from './prefs';
import { AMBIENT_FILES, AMBIENT_LOOP, AMBIENT_START, AMBIENT_VOLUME, SOUND_FILES, type AmbientId, type SoundName } from './soundFiles';

export type { AmbientId, SoundName };

let enabled = true;
getFlag('abilitySoundsOff').then((off) => {
  enabled = !off;
});

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let touched = false;
const buffers = new Map<SoundName, Promise<AudioBuffer | null>>();
const playing = new Set<AudioBufferSourceNode>();

// Safari 16.4+: тип звуковой сессии. 'playback' — играет и в беззвучном режиме, 'ambient' — молчит, как раньше.
let quietInSilent = false;
type SessionNav = Navigator & { audioSession?: { type: string } };
function applySession() {
  try {
    const nav = (typeof navigator !== 'undefined' ? navigator : null) as SessionNav | null;
    if (nav?.audioSession) nav.audioSession.type = quietInSilent ? 'ambient' : 'playback';
  } catch {
    // старый Safari — без переключателя
  }
}
applySession();
getFlag('quietInSilent').then((v) => {
  quietInSilent = v;
  applySession();
});

function context(): Ctx | null {
  if (ctx) return ctx;
  const W = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctor = W.AudioContext ?? W.webkitAudioContext;
  if (!Ctor) return null;
  try {
    applySession();
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

// Вызывается из обработчика касания: только там Safari разрешает resume()
function unlock() {
  const c = context();
  if (!c) return;
  touched = true;
  if (c.state !== 'running') {
    c.resume().catch(() => undefined);
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
  // фоновый звук ждал первого касания
  if (wanted && !amb) playAmbient(wanted);
}

if (typeof window !== 'undefined') {
  // слушаем всегда: дёшево, а после звонка или ухода в фон контекст снова «прерван»
  ['touchend', 'click', 'keydown'].forEach((e) => window.addEventListener(e, unlock, true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') ctx.resume().catch(() => undefined);
  });
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

// Беззвучный режим iPhone: true — молчать в нём (как системные звуки), false — играть всегда
export const silentSwitchSupported = () => typeof navigator !== 'undefined' && Boolean((navigator as SessionNav).audioSession);

export async function loadQuietInSilent(): Promise<boolean> {
  quietInSilent = await getFlag('quietInSilent');
  return quietInSilent;
}

export async function setQuietInSilent(value: boolean) {
  quietInSilent = value;
  applySession();
  await setFlag('quietInSilent', value);
}

// ---------- Фоновый звук места ----------
// Петля из буфера: [AMBIENT_START, AMBIENT_START + AMBIENT_LOOP] — шов точно в период, без щелчка.
// До первого касания Safari молчит — звук начнётся после него. Смена места — мягкое сведение.
let ambientOn = true;
let wanted: AmbientId | null = null;
let amb: { id: AmbientId; src: AudioBufferSourceNode; gain: GainNode } | null = null;
const ambBuffers = new Map<AmbientId, Promise<AudioBuffer | null>>();
getFlag('ambientOff').then((off) => {
  ambientOn = !off;
  if (!ambientOn) stopAmbient();
});

function loadAmbient(id: AmbientId): Promise<AudioBuffer | null> {
  let b = ambBuffers.get(id);
  if (!b) {
    b = (async () => {
      const c = context();
      if (!c) return null;
      try {
        const uri = Asset.fromModule(AMBIENT_FILES[id]).uri;
        const data = await (await fetch(uri)).arrayBuffer();
        return await new Promise<AudioBuffer>((resolve, reject) => c.decodeAudioData(data, resolve, reject));
      } catch {
        ambBuffers.delete(id);
        return null;
      }
    })();
    ambBuffers.set(id, b);
  }
  return b;
}

function stopAmbient() {
  const c = ctx;
  if (!amb || !c) return;
  const old = amb;
  amb = null;
  try {
    old.gain.gain.setTargetAtTime(0, c.currentTime, 0.35);
    setTimeout(() => {
      try {
        old.src.stop();
      } catch {
        // уже остановлен
      }
    }, 1800);
  } catch {
    // ничего
  }
}

export function playAmbient(id: AmbientId | null) {
  wanted = id;
  if (amb && amb.id === id) return;
  stopAmbient();
  if (!id || !ambientOn || !touched) return;
  const c = context();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => undefined);
  loadAmbient(id).then((buf) => {
    if (!buf || wanted !== id || amb || !ambientOn) return;
    try {
      const src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const end = Math.min(buf.duration, AMBIENT_START + AMBIENT_LOOP);
      src.loopStart = end - AMBIENT_LOOP > 0 ? end - AMBIENT_LOOP : 0;
      src.loopEnd = end;
      const gain = c.createGain();
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(AMBIENT_VOLUME, c.currentTime, 0.6);
      src.connect(gain).connect(c.destination);
      src.start(0, src.loopStart);
      amb = { id, src, gain };
    } catch {
      amb = null;
    }
  });
}

export const ambientEnabled = () => ambientOn;

export async function setAmbientEnabled(value: boolean) {
  ambientOn = value;
  if (value) {
    const w = wanted;
    playAmbient(w);
  } else stopAmbient();
  await setFlag('ambientOff', !value);
}

export async function loadAmbientEnabled(): Promise<boolean> {
  ambientOn = !(await getFlag('ambientOff'));
  return ambientOn;
}

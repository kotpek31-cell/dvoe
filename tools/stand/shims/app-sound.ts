// Стенд: без звука
export type SoundName = string;
export type AmbientId = string;
export const prepareSounds = (_n: string[]) => undefined;
export const playSound = (_n: string, _v = 1) => undefined;
export const stopSounds = () => undefined;
export const canAutoplay = () => true;
export const soundsEnabled = () => false;
export const setSoundsEnabled = async (_v: boolean) => undefined;
export const loadSoundsEnabled = async () => false;
export const silentSwitchSupported = () => false;
export const loadQuietInSilent = async () => false;
export const setQuietInSilent = async (_v: boolean) => undefined;
export const playAmbient = (_id: string | null) => undefined;
export const ambientEnabled = () => false;
export const setAmbientEnabled = async (_v: boolean) => undefined;
export const loadAmbientEnabled = async () => false;

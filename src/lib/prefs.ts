// Маленькие локальные флажки (хранятся на устройстве)
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  onboarded: 'dvoe:onboarded-0.1',
  nudgeHint: 'dvoe:hint-nudge',
  abilitySoundsOff: 'dvoe:ability-sounds-off',
  ambientOff: 'dvoe:ambient-off',
  whatsNew: 'dvoe:whats-new-0.2.2',
} as const;

type Key = keyof typeof KEYS;

export async function getFlag(key: Key): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEYS[key])) === '1';
  } catch {
    return false;
  }
}

export async function setFlag(key: Key, value = true): Promise<void> {
  try {
    if (value) await AsyncStorage.setItem(KEYS[key], '1');
    else await AsyncStorage.removeItem(KEYS[key]);
  } catch {
    // не критично
  }
}

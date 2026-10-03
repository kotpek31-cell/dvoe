// Стенд: заглушки пакетов Expo и сети. Не часть приложения.
import { createElement, type ReactNode } from 'react';

const noop = () => undefined;
const ok = () => Promise.resolve();
// expo-router
export const router = { push: noop, replace: noop, back: noop, navigate: noop, setParams: noop, canGoBack: () => false };
export const useRouter = () => router;
export const useNavigation = () => ({ isFocused: () => true, addListener: () => noop, navigate: noop, goBack: noop, setOptions: noop });
export const useFocusEffect = noop;
export const useLocalSearchParams = () => ({});
export const useSegments = () => [];
export const usePathname = () => '/';
export const Link = ({ children }: { children?: ReactNode }) => createElement('span', null, children);
export const Redirect = () => null;
export const Stack = Object.assign(({ children }: { children?: ReactNode }) => createElement('div', null, children), { Screen: () => null });
export const Tabs = Stack;
export const Slot = () => null;
// expo-haptics
export const selectionAsync = ok;
export const impactAsync = ok;
export const notificationAsync = ok;
export const ImpactFeedbackStyle = { Light: 'light', Medium: 'medium', Heavy: 'heavy' };
export const NotificationFeedbackType = { Success: 'success', Warning: 'warning', Error: 'error' };
// react-native-safe-area-context
export const useSafeAreaInsets = () => ({ top: 0, bottom: 0, left: 0, right: 0 });
export const SafeAreaProvider = ({ children }: { children?: ReactNode }) => createElement('div', { style: { display: 'flex', flex: 1 } }, children);
export const SafeAreaView = SafeAreaProvider;
// async-storage
const mem = new Map<string, string>();
const storage = {
  getItem: (k: string) => Promise.resolve(mem.get(k) ?? null),
  setItem: (k: string, v: string) => Promise.resolve(void mem.set(k, v)),
  removeItem: (k: string) => Promise.resolve(void mem.delete(k)),
  multiGet: (ks: string[]) => Promise.resolve(ks.map((k) => [k, mem.get(k) ?? null])),
};
export default storage;
// supabase-js
export const createClient = () => ({});
// expo-clipboard / constants / device / updates / linking / notifications / audio
export const setStringAsync = ok;
export const expoConfig = {};
export const isDevice = false;
export const openURL = ok;
export const createURL = () => '';
export const useAudioPlayer = () => ({ play: noop, pause: noop, seekTo: noop });
export const createAudioPlayer = () => ({ play: noop, pause: noop, seekTo: noop, remove: noop });
export const setAudioModeAsync = ok;
export const ExecutionEnvironment = { StoreClient: 'storeClient', Standalone: 'standalone', Bare: 'bare' };

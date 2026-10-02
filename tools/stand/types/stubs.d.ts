// Стенд: грубые описания типов, чтобы проверять код приложения без node_modules (tsc из глобальной установки).
// Настоящая проверка типов — `npx tsc --noEmit` в сборке (GitHub Actions); здесь ловим опечатки, забытые импорты
// и ошибки в собственных модулях. Компоненты react-native и react-native-svg — из tools/stand/shims.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'react' {
  export type ReactNode = any;
  export type ReactElement = any;
  export type Key = string | number;
  export type FC<P = object> = (props: P) => any;
  export type ComponentType<P = object> = (props: P) => any;
  export type ComponentProps<T> = any;
  export type PropsWithChildren<P = object> = P & { children?: ReactNode };
  export type Dispatch<A> = (value: A) => void;
  export type SetStateAction<S> = S | ((prev: S) => S);
  export type MutableRefObject<T> = { current: T };
  export type RefObject<T> = { current: T | null };
  export type Ref<T> = any;
  export type CSSProperties = Record<string, any>;
  export type MouseEvent = any;
  export interface Context<T> {
    Provider: (props: { value: T; children?: ReactNode }) => any;
    Consumer: any;
  }
  export function useState<S>(init: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useLayoutEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  export function useCallback<T extends (...args: any[]) => any>(fn: T, deps: readonly unknown[]): T;
  export function useRef<T>(initial: T): MutableRefObject<T>;
  export function useRef<T>(initial: T | null): RefObject<T>;
  export function useRef<T = undefined>(): MutableRefObject<T | undefined>;
  export function useId(): string;
  export function useContext<T>(context: Context<T>): T;
  export function createContext<T>(value: T): Context<T>;
  export function useReducer(...args: any[]): any;
  export function useSyncExternalStore<T>(subscribe: (onChange: () => void) => () => void, get: () => T, getServer?: () => T): T;
  export function useImperativeHandle(...args: any[]): void;
  export function memo<T>(component: T, equal?: (a: any, b: any) => boolean): T;
  export function forwardRef<T, P = object>(render: (props: P, ref: any) => any): (props: P & { ref?: any }) => any;
  export function createElement(type: any, props?: any, ...children: any[]): any;
  export function cloneElement(el: any, props?: any, ...children: any[]): any;
  export function isValidElement(el: any): boolean;
  export const Fragment: any;
  export const Children: any;
  export const StrictMode: any;
  export const Suspense: any;
  const React: any;
  export default React;
  export namespace JSX {
    type Element = any;
    interface ElementChildrenAttribute {
      children: object;
    }
    interface IntrinsicAttributes {
      key?: Key | null;
    }
    interface IntrinsicElements {
      [name: string]: any;
    }
  }
}
declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
  export namespace JSX {
    type Element = any;
    interface ElementChildrenAttribute {
      children: object;
    }
    interface IntrinsicAttributes {
      key?: string | number | null;
    }
    interface IntrinsicElements {
      [name: string]: any;
    }
  }
}
declare module 'react-dom/client' {
  export function createRoot(el: any): { render(node: any): void };
}
declare module 'expo-router';
declare module 'expo-haptics';
declare module 'expo-audio';
declare module 'expo-clipboard';
declare module 'expo-constants';
declare module 'expo-device';
declare module 'expo-notifications';
declare module 'expo-linking';
declare module 'expo-updates';
declare module 'expo-font';
declare module 'expo-splash-screen';
declare module 'expo-status-bar';
declare module 'expo-system-ui';
declare module 'expo-task-manager';
declare module 'expo-background-task';
declare module 'expo-asset';
declare module 'expo-widgets';
declare module '@expo/ui';
declare module '@expo/ui/*';
declare module '@expo-google-fonts/nunito';
declare module '@expo-google-fonts/unbounded';
declare module 'react-native-safe-area-context';
declare module 'react-native-android-widget';
declare module 'react-native-screens';
declare module '@react-native-async-storage/async-storage';
declare module '@react-native-community/datetimepicker';
declare module '@supabase/supabase-js';
declare module '@kingstinct/react-native-healthkit';
declare const process: { env: Record<string, string | undefined> };
declare const __DEV__: boolean;
declare function require(name: string): any;

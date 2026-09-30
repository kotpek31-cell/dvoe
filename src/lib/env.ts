import Constants, { ExecutionEnvironment } from 'expo-constants';

// true, если приложение запущено внутри Expo Go (без собственных нативных модулей)
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// projectId из EAS нужен для получения Expo push-токена (его записывает `eas init`)
export function getEasProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Что-то пошло не так';
}

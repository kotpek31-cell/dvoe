import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { savePushToken } from './api';
import { getEasProjectId, isExpoGo } from './env';
import { disableWebPush, syncWebPush } from './webPush';

const isWeb = Platform.OS === 'web';

// Как показывать уведомления, пока приложение открыто (в браузере не используется)
if (!isWeb) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export type PushStatus =
  | { ok: true; token: string }
  | { ok: false; reason: string };

let registration: Promise<PushStatus> | null = null;

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Двое',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 180, 120, 180],
    lightColor: '#FF6B8A',
  });
}

async function register(userId: string): Promise<PushStatus> {
  if (isWeb) {
    // На сайте разрешение спрашивается только по кнопке (Профиль → Настройки); здесь — тихая синхронизация
    await syncWebPush();
    return { ok: false, reason: 'web' };
  }
  await ensureAndroidChannel();
  if (!Device.isDevice) return { ok: false, reason: 'Push работает только на реальном телефоне.' };
  if (isExpoGo && Platform.OS === 'android') {
    return { ok: false, reason: 'В Expo Go на Android push недоступны — установите APK.' };
  }
  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return { ok: false, reason: 'Уведомления запрещены в настройках телефона.' };

  const projectId = getEasProjectId();
  if (!projectId) return { ok: false, reason: 'Нет projectId: выполните `eas init` (см. README).' };

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await savePushToken(userId, token);
  return { ok: true, token };
}

// Регистрирует устройство для push (один раз за запуск приложения)
export function registerForPushAsync(userId: string, force = false): Promise<PushStatus> {
  if (!registration || force) {
    registration = register(userId).catch((error: unknown) => {
      registration = null;
      return { ok: false, reason: error instanceof Error ? error.message : String(error) } as PushStatus;
    });
  }
  return registration;
}

// Локальные напоминания: оценка дня каждый вечер и недельный отчёт по воскресеньям
export async function scheduleReminders(): Promise<void> {
  if (isWeb) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    identifier: 'daily-score',
    content: { title: 'Как прошёл день?', body: 'Поставь оценку дню и загляни, как дела у партнёра', data: { type: 'score' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 21, minute: 30, channelId: 'default' },
  });
  await Notifications.scheduleNotificationAsync({
    identifier: 'weekly-report',
    content: { title: 'Итоги недели', body: 'Посмотрите вместе, как прошла ваша неделя', data: { type: 'report' } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1, // 1 = воскресенье
      hour: 20,
      minute: 0,
      channelId: 'default',
    },
  });
}

// Куда вести пользователя по нажатию на уведомление
export function routeForNotification(data: Record<string, unknown> | undefined): string {
  switch (data?.type) {
    case 'wish':
      return '/profile';
    case 'question':
      return '/us';
    case 'report':
      return '/stats';
    case 'score':
      return '/day-score';
    default:
      return '/home';
  }
}

export async function unregisterPush(userId: string): Promise<void> {
  registration = null;
  if (isWeb) {
    await disableWebPush();
    return;
  }
  await savePushToken(userId, null);
}

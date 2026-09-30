import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/context/AuthProvider';
import { PairProvider } from '../src/context/PairProvider';
import { routeForNotification } from '../src/lib/notifications';
import { setupWebApp } from '../src/lib/webApp';
import { C } from '../src/theme';

// Нажатие на уведомление открывает нужный экран
function NotificationRouter() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      setTimeout(() => router.push(routeForNotification(data) as never), 300);
    };
    Notifications.getLastNotificationResponseAsync()
      .then(open)
      .catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
  return null;
}

export default function RootLayout() {
  useEffect(() => {
    setupWebApp();
  }, []);
  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: C.bg }}>
      <AuthProvider>
        <PairProvider>
          <StatusBar style="light" />
          <NotificationRouter />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: C.bg },
              headerTintColor: C.text,
              headerTitleStyle: { fontWeight: '700' },
              headerShadowVisible: false,
              headerBackTitle: 'Назад',
              contentStyle: { backgroundColor: C.bg },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="sign-in" options={{ headerShown: false }} />
            <Stack.Screen name="pair" options={{ title: 'Пара' }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="day-score" options={{ title: 'Итог дня', presentation: 'modal' }} />
            <Stack.Screen name="settings" options={{ title: 'Настройки' }} />
            <Stack.Screen name="questions" options={{ title: 'Архив вопросов' }} />
          </Stack>
        </PairProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

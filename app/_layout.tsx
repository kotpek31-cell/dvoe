import { Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { Unbounded_600SemiBold, Unbounded_700Bold } from '@expo-google-fonts/unbounded';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CastBanner } from '../src/components/CastBanner';
import { WhatsNew } from '../src/components/WhatsNew';
import { AbilityProvider } from '../src/context/AbilityProvider';
import { AuthProvider } from '../src/context/AuthProvider';
import { PairProvider } from '../src/context/PairProvider';
import { routeForNotification } from '../src/lib/notifications';
import { setupWebApp } from '../src/lib/webApp';
import { C } from '../src/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

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
  const [fontsLoaded, fontError] = useFonts({
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Unbounded_600SemiBold,
    Unbounded_700Bold,
  });
  const ready = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    setupWebApp();
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: C.bg }}>
      <AuthProvider>
        <PairProvider>
          <AbilityProvider>
          <StatusBar style="light" />
          <NotificationRouter />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'fade_from_bottom' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="sign-in" />
            <Stack.Screen name="pair" />
            <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="day-score" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="questions" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="wardrobe" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="dev" options={{ animation: 'slide_from_right' }} />
          </Stack>
          <CastBanner />
          <WhatsNew />
          </AbilityProvider>
        </PairProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

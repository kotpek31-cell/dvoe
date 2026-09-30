import { Redirect, Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { TabBar } from '../../src/components/TabBar';
import { Loading } from '../../src/components/ui';
import { useAuth } from '../../src/context/AuthProvider';
import { usePair } from '../../src/context/PairProvider';
import { hasChosenChibi } from '../../src/lib/chibi';
import { getFlag } from '../../src/lib/prefs';
import { useBackgroundSync } from '../../src/lib/sync';
import { C } from '../../src/theme';

export default function TabsLayout() {
  const { session, initializing } = useAuth();
  const { me, loading } = usePair();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  useBackgroundSync();

  useEffect(() => {
    getFlag('onboarded').then(setOnboarded);
  }, []);

  if (initializing || (session && loading) || onboarded === null) return <Loading />;
  if (!session) return <Redirect href="/sign-in" />;
  if (!me?.pair_id) return <Redirect href="/pair" />;
  if (!onboarded && !hasChosenChibi(me)) return <Redirect href="/onboarding" />;

  return (
    <View style={styles.root}>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        // Каждая вкладка непрозрачная (свой фон-аврора): активная целиком закрывает остальные —
        // в вебе навигатор не всегда прячет неактивные вкладки
        screenOptions={{ headerShown: false, sceneStyle: styles.scene }}
      >
        <Tabs.Screen name="home" options={{ title: 'Главная' }} />
        <Tabs.Screen name="mood" options={{ title: 'Настроение' }} />
        <Tabs.Screen name="sleep" options={{ title: 'Сон' }} />
        <Tabs.Screen name="us" options={{ title: 'Мы' }} />
        <Tabs.Screen name="stats" options={{ title: 'Итоги' }} />
        <Tabs.Screen name="profile" options={{ title: 'Профиль' }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scene: { backgroundColor: C.bg },
});

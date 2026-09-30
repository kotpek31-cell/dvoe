import { Redirect, Tabs, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Aurora } from '../../src/components/Aurora';
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
  const pathname = usePathname();
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
      {/* Один фон на все вкладки; на главной его закрывает локация — там аврору не крутим */}
      <Aurora paused={pathname === '/home' || pathname === '/'} />
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
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
});

import { Redirect, router, Tabs } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { Loading } from '../../src/components/ui';
import { useAuth } from '../../src/context/AuthProvider';
import { usePair } from '../../src/context/PairProvider';
import { useBackgroundSync } from '../../src/lib/sync';
import { C } from '../../src/theme';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 21, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>;
}

function SettingsButton() {
  return (
    <Pressable onPress={() => router.push('/settings')} hitSlop={12} style={{ paddingHorizontal: 16 }}>
      <Text style={{ fontSize: 20 }}>⚙️</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  const { session, initializing } = useAuth();
  const { me, loading } = usePair();
  useBackgroundSync();

  if (initializing || (session && loading)) return <Loading />;
  if (!session) return <Redirect href="/sign-in" />;
  if (!me?.pair_id) return <Redirect href="/pair" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: C.bg },
        headerTintColor: C.text,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        headerRight: () => <SettingsButton />,
        tabBarStyle: { backgroundColor: C.card, borderTopColor: C.border },
        tabBarActiveTintColor: C.text,
        tabBarInactiveTintColor: C.faint,
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{ title: 'Сегодня', tabBarIcon: ({ focused }) => <TabIcon emoji="☀️" focused={focused} /> }}
      />
      <Tabs.Screen
        name="sleep"
        options={{ title: 'Сон', tabBarIcon: ({ focused }) => <TabIcon emoji="🌙" focused={focused} /> }}
      />
      <Tabs.Screen
        name="mood"
        options={{ title: 'Настроение', tabBarIcon: ({ focused }) => <TabIcon emoji="🎭" focused={focused} /> }}
      />
      <Tabs.Screen
        name="wishes"
        options={{ title: 'Желания', tabBarIcon: ({ focused }) => <TabIcon emoji="🎁" focused={focused} /> }}
      />
      <Tabs.Screen
        name="stats"
        options={{ title: 'Итоги', tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} /> }}
      />
    </Tabs>
  );
}

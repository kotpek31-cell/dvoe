import { Redirect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Loading } from '../src/components/ui';
import { useAuth } from '../src/context/AuthProvider';
import { usePair } from '../src/context/PairProvider';
import { isSupabaseConfigured } from '../src/lib/supabase';
import { C } from '../src/theme';

// Стартовый экран: решает, куда отправить пользователя
export default function Index() {
  const { session, initializing, signOut } = useAuth();
  const { me, loading, error, refresh } = usePair();

  if (!isSupabaseConfigured) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Supabase не настроен</Text>
        <Text style={styles.text}>
          Создайте файл .env по образцу .env.example, вставьте Project URL и Publishable key из Supabase и перезапустите
          `npx expo start --clear`.
        </Text>
      </View>
    );
  }
  if (initializing || (session && loading)) return <Loading />;
  if (!session) return <Redirect href="/sign-in" />;
  if (!me && error) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Нет связи с сервером</Text>
        <Text style={styles.text}>{error}</Text>
        <Button title="Повторить" onPress={refresh} />
        <Button title="Выйти из аккаунта" variant="ghost" onPress={signOut} />
      </View>
    );
  }
  if (!me?.pair_id) return <Redirect href="/pair" />;
  return <Redirect href="/today" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: C.bg, padding: 24, justifyContent: 'center', gap: 14 },
  title: { color: C.text, fontSize: 22, fontWeight: '700' },
  text: { color: C.muted, fontSize: 15, lineHeight: 21 },
});

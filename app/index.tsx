import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Aurora } from '../src/components/Aurora';
import { Button, Loading, Txt } from '../src/components/ui';
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
        <Aurora />
        <Txt weight="display" size={22}>
          Supabase не настроен
        </Txt>
        <Txt muted>
          Создайте файл .env по образцу .env.example, вставьте Project URL и Publishable key из Supabase и перезапустите
          `npx expo start --clear`.
        </Txt>
      </View>
    );
  }
  if (initializing || (session && loading)) return <Loading />;
  if (!session) return <Redirect href="/sign-in" />;
  if (!me && error) {
    return (
      <View style={styles.center}>
        <Aurora />
        <Txt weight="display" size={22}>
          Нет связи с сервером
        </Txt>
        <Txt muted>{error}</Txt>
        <Button title="Повторить" onPress={refresh} />
        <Button title="Выйти из аккаунта" variant="ghost" onPress={signOut} />
      </View>
    );
  }
  if (!me?.pair_id) return <Redirect href="/pair" />;
  return <Redirect href="/home" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: C.bg, padding: 24, justifyContent: 'center', gap: 14 },
});

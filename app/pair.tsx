import { router } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Input, Screen, showError, Txt } from '../src/components/ui';
import { useAuth } from '../src/context/AuthProvider';
import { usePair } from '../src/context/PairProvider';
import { createPair, joinPair } from '../src/lib/api';
import { C, S } from '../src/theme';

export default function PairScreen() {
  const { signOut } = useAuth();
  const { me, partner, pair, refresh } = usePair();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);

  const onCreate = async () => {
    setBusy('create');
    try {
      await createPair();
      await refresh();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(null);
    }
  };

  const onJoin = async () => {
    if (code.trim().length < 6) return showError('Код состоит из 6 символов');
    setBusy('join');
    try {
      await joinPair(code);
      await refresh();
      router.replace('/today');
    } catch (e) {
      showError(e);
    } finally {
      setBusy(null);
    }
  };

  const shareCode = () => {
    if (!pair) return;
    Share.share({
      message: `Давай вести общий дневник в приложении «Двое» 💞 Мой код пары: ${pair.invite_code}`,
    }).catch(() => undefined);
  };

  // Уже в паре
  if (me?.pair_id && pair) {
    return (
      <Screen onRefresh={refresh}>
        {partner ? (
          <Card>
            <Text style={styles.big}>💞</Text>
            <Txt size={20} bold style={styles.center}>
              Вы в паре с {partner.display_name}
            </Txt>
            <Button title="Открыть дневник" onPress={() => router.replace('/today')} />
          </Card>
        ) : (
          <Card title="Ждём второго человека">
            <Txt muted>Передайте этот код партнёру — он введёт его на своём телефоне в разделе «У меня есть код».</Txt>
            <Text style={styles.code}>{pair.invite_code}</Text>
            <Button title="Поделиться кодом" onPress={shareCode} />
            <Button title="Пока заполнять дневник одному" variant="secondary" onPress={() => router.replace('/today')} />
            <Txt muted size={13}>
              Экран обновится сам, когда партнёр присоединится (или потяните вниз).
            </Txt>
          </Card>
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <Txt size={22} bold>
        Привет, {me?.display_name ?? 'друг'}!
      </Txt>
      <Txt muted>Дневник общий для двоих: один создаёт пару и получает код, второй вводит этот код.</Txt>

      <Card title="Создать пару">
        <Txt muted>Вы получите код из 6 символов и отправите его партнёру.</Txt>
        <Button title="Создать и получить код" onPress={onCreate} loading={busy === 'create'} />
      </Card>

      <Card title="У меня есть код">
        <Input
          placeholder="Например, K7M2QX"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.codeInput}
        />
        <Button title="Присоединиться" onPress={onJoin} loading={busy === 'join'} />
      </Card>

      <View style={{ marginTop: S.lg }}>
        <Button
          title="Выйти из аккаунта"
          variant="ghost"
          onPress={async () => {
            await signOut().catch(showError);
            router.replace('/sign-in');
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 48, textAlign: 'center' },
  center: { textAlign: 'center' },
  code: {
    color: C.accent,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: S.md,
  },
  codeInput: { fontSize: 24, letterSpacing: 6, textAlign: 'center', fontWeight: '700' },
});

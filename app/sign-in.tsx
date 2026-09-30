import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chibi } from '../src/components/Chibi';
import { Button, Input, Screen, Segmented, showError, Txt } from '../src/components/ui';
import { translateError } from '../src/lib/api';
import { supabase } from '../src/lib/supabase';
import { C, S } from '../src/theme';

type Mode = 'login' | 'register';

export default function SignIn() {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) return showError('Введи email');
    if (password.length < 6) return showError('Пароль — минимум 6 символов');
    if (mode === 'register' && !name.trim()) return showError('Как тебя называть? Введи имя');
    setBusy(true);
    setInfo(null);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) throw new Error(translateError(error.message));
        router.replace('/');
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { display_name: name.trim().slice(0, 40) } },
        });
        if (error) throw new Error(translateError(error.message));
        if (data.session) {
          router.replace('/');
        } else {
          setInfo(
            'Аккаунт создан. Подтверди email по ссылке из письма и войди. ' +
              'Чтобы письма не требовались, отключи «Confirm email» в Supabase → Authentication (см. README).',
          );
          setMode('login');
        }
      }
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen background>
      <View style={styles.duo}>
        <Chibi kind="boy" emotion="joy" value={55} pose="idle" size={96} look={3} />
        <Chibi kind="girl" emotion="love" value={45} pose="idle" size={96} look={-3} />
      </View>
      <Txt weight="display" size={36} center>
        Двое
      </Txt>
      <Txt muted center style={styles.subtitle}>
        Общий дневник для двоих: сон, настроение, желания и маленькие чибики, которые гуляют вместе
      </Txt>

      <Segmented
        options={[
          { value: 'login', label: 'Вход' },
          { value: 'register', label: 'Регистрация' },
        ]}
        value={mode}
        onChange={setMode}
      />

      <View style={styles.form}>
        {mode === 'register' ? (
          <Input placeholder="Твоё имя" value={name} onChangeText={setName} autoCapitalize="words" maxLength={40} />
        ) : null}
        <Input
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <Input
          placeholder="Пароль (от 6 символов)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          textContentType={mode === 'login' ? 'password' : 'newPassword'}
        />
        <Button title={mode === 'login' ? 'Войти' : 'Создать аккаунт'} onPress={submit} loading={busy} />
        {info ? (
          <Txt color={C.warn} size={14}>
            {info}
          </Txt>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  duo: { flexDirection: 'row', justifyContent: 'center', gap: S.sm, marginTop: S.xl },
  subtitle: { marginBottom: S.md },
  form: { gap: S.md },
});

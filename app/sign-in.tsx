import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Input, Segmented, showError } from '../src/components/ui';
import { translateError } from '../src/lib/api';
import { supabase } from '../src/lib/supabase';
import { C, S } from '../src/theme';

type Mode = 'login' | 'register';

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) return showError('Введите email');
    if (password.length < 6) return showError('Пароль — минимум 6 символов');
    if (mode === 'register' && !name.trim()) return showError('Как вас называть? Введите имя');
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
            'Аккаунт создан. Подтвердите email по ссылке из письма и войдите. ' +
              'Чтобы письма не требовались, отключите «Confirm email» в Supabase → Authentication (см. README).',
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
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.logo}>💞</Text>
        <Text style={styles.title}>Двое</Text>
        <Text style={styles.subtitle}>Общий дневник: сон, настроение, желания и маленькая игра каждый день</Text>

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
            <Input placeholder="Ваше имя" value={name} onChangeText={setName} autoCapitalize="words" maxLength={40} />
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
          {info ? <Text style={styles.info}>{info}</Text> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: S.xl, gap: S.lg },
  logo: { fontSize: 56, textAlign: 'center' },
  title: { color: C.text, fontSize: 34, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: C.muted, fontSize: 15, textAlign: 'center', lineHeight: 21, marginBottom: S.md },
  form: { gap: S.md },
  info: { color: C.warn, fontSize: 14, lineHeight: 20 },
});

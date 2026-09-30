import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as ScreenSleep from '../modules/screen-sleep';
import { Button, Card, Input, Loading, Row, Screen, showError, Txt } from '../src/components/ui';
import { useAuth } from '../src/context/AuthProvider';
import { usePair } from '../src/context/PairProvider';
import { leavePair, updateMyProfile } from '../src/lib/api';
import { confirmAction, notify } from '../src/lib/dialogs';
import { isExpoGo } from '../src/lib/env';
import { isHealthKitSupported, requestSleepAccess } from '../src/lib/healthkit';
import { registerForPushAsync, scheduleReminders } from '../src/lib/notifications';
import { refreshWidgets } from '../src/lib/widgets';
import { C, R, S } from '../src/theme';

const AVATARS = ['🙂', '😎', '🦊', '🐻', '🐱', '🐶', '🐼', '🦋', '🌸', '🌙', '⭐', '🔥', '🍓', '🎧', '🧸', '🐸'];

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const { me, partner, pair, refresh } = usePair();
  const [name, setName] = useState(me?.display_name ?? '');
  const [avatar, setAvatar] = useState(me?.avatar_emoji ?? '🙂');
  const [goal, setGoal] = useState(me?.water_goal ?? 8);
  const [saving, setSaving] = useState(false);
  const [pushInfo, setPushInfo] = useState<string | null>(null);
  const [usageAccess, setUsageAccess] = useState(ScreenSleep.hasUsageAccess());

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setUsageAccess(ScreenSleep.hasUsageAccess());
    });
    return () => sub.remove();
  }, []);

  if (!me) return <Loading />;

  const saveProfile = async () => {
    if (!name.trim()) return showError('Имя не может быть пустым');
    setSaving(true);
    try {
      await updateMyProfile(me.id, { display_name: name.trim().slice(0, 40), avatar_emoji: avatar, water_goal: goal });
      await refresh();
      refreshWidgets();
      notify('Сохранено', 'Профиль обновлён');
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  const enablePush = async () => {
    const res = await registerForPushAsync(me.id, true);
    if (res.ok) {
      await scheduleReminders().catch(() => undefined);
      setPushInfo('Уведомления включены ✅');
    } else {
      setPushInfo(res.reason);
    }
  };

  const confirmLeave = () =>
    confirmAction(
      'Выйти из пары?',
      'Записи останутся в паре. Вернуться можно по тому же коду, если место свободно.',
      'Выйти',
      async () => {
        try {
          await leavePair();
          await refresh();
          router.replace('/pair');
        } catch (e) {
          showError(e);
        }
      },
      true,
    );

  return (
    <Screen>
      <Card title="Профиль">
        <Input placeholder="Имя" value={name} onChangeText={setName} maxLength={40} />
        <View style={styles.avatars}>
          {AVATARS.map((a) => (
            <Pressable key={a} onPress={() => setAvatar(a)} style={[styles.avatar, a === avatar && styles.avatarActive]}>
              <Text style={styles.avatarText}>{a}</Text>
            </Pressable>
          ))}
        </View>
        <Row style={styles.between}>
          <Txt>Цель по воде: {goal} стаканов</Txt>
          <Row gap={S.sm}>
            <Button title="−" variant="secondary" small onPress={() => setGoal(Math.max(1, goal - 1))} />
            <Button title="+" variant="secondary" small onPress={() => setGoal(Math.min(30, goal + 1))} />
          </Row>
        </Row>
        <Button title="Сохранить профиль" onPress={saveProfile} loading={saving} />
      </Card>

      <Card title="Пара">
        <Txt>{partner ? `Вы в паре с ${partner.display_name} ${partner.avatar_emoji}` : 'Партнёр ещё не присоединился'}</Txt>
        {pair ? (
          <Row style={styles.between}>
            <Txt muted>
              Код пары:{' '}
              <Txt bold color={C.accent}>
                {pair.invite_code}
              </Txt>
            </Txt>
            <Button
              title="Поделиться"
              variant="ghost"
              small
              onPress={() => Share.share({ message: `Код пары в «Двое»: ${pair.invite_code}` }).catch(() => undefined)}
            />
          </Row>
        ) : null}
        <Button title="Выйти из пары" variant="danger" onPress={confirmLeave} />
      </Card>

      <Card title="Уведомления">
        <Txt muted size={14}>
          «Думаю о тебе», ответы на вопрос дня, исполненные желания, напоминание оценить день в 21:30 и недельный отчёт в
          воскресенье.
        </Txt>
        <Button title="Включить / проверить уведомления" variant="secondary" onPress={enablePush} />
        {pushInfo ? <Txt size={14}>{pushInfo}</Txt> : null}
      </Card>

      {Platform.OS === 'web' ? (
        <Card title="Веб-версия">
          <Txt muted size={14}>
            Вы открыли «Двое» в браузере. Здесь всё синхронизируется с партнёром, но нет push-уведомлений, автоопределения сна и
            виджета. На iPhone установите сайт как приложение: Safari → «Поделиться» → «На экран Домой».
          </Txt>
        </Card>
      ) : null}

      {Platform.OS !== 'web' ? (
        <Card title="Сон">
          {Platform.OS === 'android' ? (
            <>
              <Txt size={14} muted>
                {!ScreenSleep.isAvailable
                  ? 'Автоопределение доступно в установленном APK (в Expo Go не работает).'
                  : usageAccess
                    ? 'Доступ к истории использования выдан ✅'
                    : 'Нужен доступ к истории использования, чтобы определять сон по экрану.'}
              </Txt>
              {ScreenSleep.isAvailable ? (
                <Button
                  title="Открыть настройки доступа"
                  variant="secondary"
                  onPress={() => ScreenSleep.openUsageAccessSettings()}
                />
              ) : null}
            </>
          ) : (
            <>
              <Txt size={14} muted>
                {isHealthKitSupported()
                  ? 'Сон читается из «Здоровья». Проверить доступ: Настройки iPhone → Здоровье → Доступ к данным → Двое.'
                  : 'Apple Health доступен в сборке из TestFlight (в Expo Go не работает).'}
              </Txt>
              {isHealthKitSupported() ? (
                <Button
                  title="Подключить Apple Health"
                  variant="secondary"
                  onPress={async () => {
                    const ok = await requestSleepAccess();
                    notify(
                      ok ? 'Готово' : 'Не получилось',
                      ok ? 'Данные сна будут подтягиваться автоматически.' : 'HealthKit недоступен на этом устройстве.',
                    );
                  }}
                />
              ) : null}
            </>
          )}
        </Card>
      ) : null}

      {Platform.OS !== 'web' ? (
        <Card title="Виджет">
          <Txt muted size={14}>
            {Platform.OS === 'ios'
              ? 'Удерживайте палец на главном экране → «+» → найдите «Двое» → выберите размер. Виджет обновляется, когда открыто приложение, и в фоне по решению iOS.'
              : 'Удерживайте палец на главном экране → «Виджеты» → «Двое — партнёр». Виджет обновляется сам каждые 30 минут и сразу при изменениях в приложении.'}
            {isExpoGo ? ' В Expo Go виджет недоступен — нужна сборка.' : ''}
          </Txt>
        </Card>
      ) : null}

      <Card title="Аккаунт">
        <Txt muted size={14}>
          {session?.user.email}
        </Txt>
        <Button
          title="Выйти из аккаунта"
          variant="secondary"
          onPress={async () => {
            await signOut().catch(showError);
            router.replace('/sign-in');
          }}
        />
        <Txt muted size={12}>
          Версия {Constants.expoConfig?.version ?? '1.0.0'}
        </Txt>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { justifyContent: 'space-between' },
  avatars: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: R.md,
    backgroundColor: C.card2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarActive: { borderColor: C.accent },
  avatarText: { fontSize: 22 },
});

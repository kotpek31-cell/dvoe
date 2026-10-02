// Настройки: имя, пара, уведомления, сон, виджет, аккаунт
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Share, StyleSheet, Switch, View } from 'react-native';
import * as ScreenSleep from '../modules/screen-sleep';
import { Button, Card, Input, Pressy, Row, Screen, showError, Txt } from '../src/components/ui';
import { useAuth } from '../src/context/AuthProvider';
import { usePair } from '../src/context/PairProvider';
import { leavePair, updateMyProfile } from '../src/lib/api';
import { confirmAction, notify } from '../src/lib/dialogs';
import { isExpoGo } from '../src/lib/env';
import { isHealthKitSupported, requestSleepAccess } from '../src/lib/healthkit';
import { refreshAccess, useAccess } from '../src/lib/access';
import { haptic } from '../src/lib/motion';
import { registerForPushAsync, scheduleReminders } from '../src/lib/notifications';
import { loadAmbientEnabled, loadSoundsEnabled, setAmbientEnabled, setSoundsEnabled } from '../src/lib/sound';
import { enableWebPush, webPushState, type WebPushState } from '../src/lib/webPush';
import { refreshWidgets } from '../src/lib/widgets';
import { C, S } from '../src/theme';

const WEB_PUSH_TEXT: Record<WebPushState, string> = {
  unsupported: 'Этот браузер не поддерживает push-уведомления.',
  'needs-install': 'Уведомления на iPhone работают, только если открыть «Двое» с экрана «Домой»: Safari → «Поделиться» → «На экран Домой». Потом включи их здесь.',
  denied: 'Уведомления запрещены. Включить: Настройки iPhone → Уведомления → Двое.',
  off: 'Уведомления выключены.',
  on: 'Уведомления включены.',
};

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const { me, partner, pair, refresh } = usePair();
  const [name, setName] = useState(me?.display_name ?? '');
  const [saving, setSaving] = useState(false);
  const [pushInfo, setPushInfo] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [webState, setWebState] = useState<WebPushState | null>(null);
  const [usageAccess, setUsageAccess] = useState(ScreenSleep.hasUsageAccess());
  const [sounds, setSounds] = useState(true);
  const [ambient, setAmbient] = useState(true);
  const [copied, setCopied] = useState(false);
  const access = useAccess();
  const taps = useRef<number[]>([]);

  // 7 нажатий на номер версии за 4 секунды — комната разработчиков (только с ролью; у остальных ничего)
  const tapVersion = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 4000), now];
    if (taps.current.length < 7) return;
    taps.current = [];
    if (access) {
      haptic.success();
      router.push('/dev');
    } else if (session?.user.id) {
      refreshAccess(session.user.id); // вдруг роль выдали только что
    }
  };

  useEffect(() => {
    loadSoundsEnabled().then(setSounds).catch(() => undefined);
    loadAmbientEnabled().then(setAmbient).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') webPushState().then(setWebState).catch(() => setWebState('unsupported'));
    if (Platform.OS !== 'android') return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setUsageAccess(ScreenSleep.hasUsageAccess());
    });
    return () => sub.remove();
  }, []);

  if (!me) return null;

  const saveName = async () => {
    if (!name.trim()) return showError('Имя не может быть пустым');
    setSaving(true);
    try {
      await updateMyProfile(me.id, { display_name: name.trim().slice(0, 40) });
      await refresh();
      refreshWidgets();
      notify('Сохранено', 'Имя обновлено');
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  const enablePush = async () => {
    setPushBusy(true);
    try {
      if (Platform.OS === 'web') {
        const res = await enableWebPush();
        setPushInfo(res.message);
        setWebState(await webPushState().catch(() => 'unsupported' as WebPushState));
        return;
      }
      const res = await registerForPushAsync(me.id, true);
      if (res.ok) {
        await scheduleReminders().catch(() => undefined);
        setPushInfo('Уведомления включены');
      } else {
        setPushInfo(res.reason);
      }
    } finally {
      setPushBusy(false);
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
    <Screen background back title="Настройки">
      <Card title="Имя">
        <Input placeholder="Как тебя называть" value={name} onChangeText={setName} maxLength={40} />
        <Button title="Сохранить имя" onPress={saveName} loading={saving} disabled={!name.trim() || name.trim() === me.display_name} />
      </Card>

      <Card title="Пара">
        <Txt>{partner ? `Вы в паре с ${partner.display_name}` : 'Партнёр ещё не присоединился'}</Txt>
        {pair ? (
          <Row style={styles.between}>
            <Txt muted>
              Код пары:{' '}
              <Txt weight="display" color={C.accent}>
                {pair.invite_code}
              </Txt>
            </Txt>
            <Button
              title="Поделиться"
              variant="ghost"
              small
              icon="share"
              onPress={() => Share.share({ message: `Код пары в «Двое»: ${pair.invite_code}` }).catch(() => undefined)}
            />
          </Row>
        ) : null}
        <Button title="Выйти из пары" variant="danger" onPress={confirmLeave} />
      </Card>

      <Card title="Уведомления">
        <Txt muted size={14}>
          «Думаю о тебе», ответы на вопрос дня и исполненные желания
          {Platform.OS === 'web' ? '.' : ', а ещё напоминание оценить день в 21:30 и итоги недели в воскресенье.'}
        </Txt>
        {Platform.OS === 'web' && webState ? (
          <Txt size={14} color={webState === 'on' ? C.good : C.text}>
            {WEB_PUSH_TEXT[webState]}
          </Txt>
        ) : null}
        {Platform.OS !== 'web' || (webState !== 'needs-install' && webState !== 'unsupported') ? (
          <Button
            title={Platform.OS === 'web' && webState === 'on' ? 'Проверить уведомления' : 'Включить уведомления'}
            icon="bell"
            variant="secondary"
            onPress={enablePush}
            loading={pushBusy}
          />
        ) : null}
        {pushInfo ? <Txt size={14}>{pushInfo}</Txt> : null}
      </Card>

      <Card title="Звуки">
        <Row style={styles.between}>
          <View style={styles.flex}>
            <Txt weight="heavy" size={16}>
              Звуки способностей
            </Txt>
            <Txt muted size={13}>
              {Platform.OS === 'web' ? 'В беззвучном режиме iPhone звука не будет' : 'Играют на громкости медиа'}
            </Txt>
          </View>
          <Switch
            value={sounds}
            onValueChange={(v) => {
              setSounds(v);
              setSoundsEnabled(v).catch(() => undefined);
            }}
            trackColor={{ false: 'rgba(255,255,255,0.18)', true: C.accent }}
            thumbColor="#FFFFFF"
            accessibilityLabel="Звуки способностей"
          />
        </Row>
        <Row style={styles.between}>
          <View style={styles.flex}>
            <Txt weight="heavy" size={16}>
              Звуки места
            </Txt>
            <Txt muted size={13}>
              Тихий фон на главной: костёр, дождь, волны
            </Txt>
          </View>
          <Switch
            value={ambient}
            onValueChange={(v) => {
              setAmbient(v);
              setAmbientEnabled(v).catch(() => undefined);
            }}
            trackColor={{ false: 'rgba(255,255,255,0.18)', true: C.accent }}
            thumbColor="#FFFFFF"
            accessibilityLabel="Звуки места"
          />
        </Row>
      </Card>

      {Platform.OS === 'android' ? (
        <Card title="Сон">
          <Txt size={14} muted>
            {!ScreenSleep.isAvailable
              ? 'Автоопределение доступно в установленном APK (в Expo Go не работает).'
              : usageAccess
                ? 'Доступ к истории использования выдан — сон считается сам.'
                : 'Нужен доступ к истории использования, чтобы сон считался по экрану.'}
          </Txt>
          {ScreenSleep.isAvailable ? (
            <Button
              title={usageAccess ? 'Открыть настройки доступа' : 'Разрешить доступ'}
              variant="secondary"
              onPress={() => ScreenSleep.openUsageAccessSettings()}
            />
          ) : null}
        </Card>
      ) : null}

      {Platform.OS === 'ios' ? (
        <Card title="Сон">
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
                notify(ok ? 'Готово' : 'Не получилось', ok ? 'Данные сна будут подтягиваться автоматически.' : 'HealthKit недоступен.');
              }}
            />
          ) : null}
        </Card>
      ) : null}

      {Platform.OS === 'web' ? (
        <Card title="Сон на iPhone">
          <Txt muted size={14}>
            Сайт не видит, когда гаснет экран, поэтому сон отмечается кнопками «Иду спать» и «Проснулся» во вкладке «Сон».
          </Txt>
        </Card>
      ) : null}

      {Platform.OS === 'android' ? (
        <Card title="Виджет">
          <Txt muted size={14}>
            Удерживай палец на главном экране → «Виджеты» → «Двое — партнёр». На виджете — лицо настроения партнёра и оценка дня;
            обновляется сам каждые 30 минут и сразу при изменениях в приложении.
            {isExpoGo ? ' В Expo Go виджет недоступен — нужна сборка.' : ''}
          </Txt>
        </Card>
      ) : null}

      <Card title="Аккаунт">
        <Txt muted size={14}>
          {session?.user.email}
        </Txt>
        {me.short_id ? (
          <Row style={styles.between}>
            <View style={styles.flex}>
              <Txt weight="heavy" size={16}>
                Твой ID: {me.short_id}
              </Txt>
              <Txt muted size={13}>
                {copied ? 'Скопировано' : 'Нужен, если тебе выдают роль или вещь'}
              </Txt>
            </View>
            <Button
              title="Скопировать"
              small
              variant="secondary"
              onPress={() => {
                Clipboard.setStringAsync(me.short_id!)
                  .then(() => {
                    haptic.tap();
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  })
                  .catch(() => undefined);
              }}
            />
          </Row>
        ) : null}
        <Button
          title="Выйти из аккаунта"
          variant="secondary"
          icon="logout"
          onPress={async () => {
            await signOut().catch(showError);
            router.replace('/sign-in');
          }}
        />
        <Pressy onPress={tapVersion} haptics={false} scaleTo={1} style={styles.version} accessibilityRole="none" accessibilityLabel={`Версия ${Constants.expoConfig?.version ?? ''}`}>
          <Txt faint size={12}>
            Двое · версия {Constants.expoConfig?.version ?? '0.2.0'}
          </Txt>
        </Pressy>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { justifyContent: 'space-between', alignItems: 'center' },
  flex: { flex: 1 },
  version: { alignItems: 'center', marginTop: S.xs },
});

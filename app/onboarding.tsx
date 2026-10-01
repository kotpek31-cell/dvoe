// Знакомство с 0.1 (один раз): выбрать чибика, включить уведомления, на Android — доступ для сна
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import * as ScreenSleep from '../modules/screen-sleep';
import { Chibi } from '../src/components/Chibi';
import { Button, Card, Pressy, Screen, showError, Txt } from '../src/components/ui';
import { usePair } from '../src/context/PairProvider';
import { updateMyProfile } from '../src/lib/api';
import { CHIBI_KINDS, CHIBI_LABELS, chibiKindOf, hasChosenChibi, LOOKS } from '../src/lib/chibi';
import { haptic } from '../src/lib/motion';
import { registerForPushAsync, scheduleReminders } from '../src/lib/notifications';
import { setFlag } from '../src/lib/prefs';
import { enableWebPush, webPushState } from '../src/lib/webPush';
import { C, R, S } from '../src/theme';
import type { ChibiKind } from '../src/types';

type Step = 'chibi' | 'push' | 'sleep';

export default function Onboarding() {
  const { me, refresh } = usePair();
  const [kind, setKind] = useState<ChibiKind>(hasChosenChibi(me) ? chibiKindOf(me) : 'nb');
  const [step, setStep] = useState<Step>('chibi');
  const [busy, setBusy] = useState(false);
  const [pushNote, setPushNote] = useState<string | null>(null);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [access, setAccess] = useState(ScreenSleep.hasUsageAccess());
  const askSleep = Platform.OS === 'android' && ScreenSleep.isAvailable;
  const steps: Step[] = askSleep ? ['chibi', 'push', 'sleep'] : ['chibi', 'push'];

  useEffect(() => {
    if (Platform.OS === 'web') webPushState().then((s) => setNeedsInstall(s === 'needs-install')).catch(() => undefined);
    if (Platform.OS !== 'android') return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setAccess(ScreenSleep.hasUsageAccess());
    });
    return () => sub.remove();
  }, []);

  const finish = async () => {
    await setFlag('onboarded');
    router.replace('/home');
  };

  const next = () => {
    const i = steps.indexOf(step);
    if (i < steps.length - 1) setStep(steps[i + 1]);
    else finish();
  };

  const saveChibi = async () => {
    if (!me) return;
    setBusy(true);
    try {
      await updateMyProfile(me.id, { chibi: { ...(me.chibi ?? {}), kind } });
      await refresh();
      haptic.success();
      next();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const enablePush = async () => {
    if (!me) return;
    setBusy(true);
    try {
      if (Platform.OS === 'web') {
        const res = await enableWebPush();
        setPushNote(res.message);
        if (res.ok) next();
        return;
      }
      const res = await registerForPushAsync(me.id, true);
      if (res.ok) {
        await scheduleReminders().catch(() => undefined);
        next();
      } else {
        setPushNote(res.reason);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen background>
      <View style={styles.dots}>
        {steps.map((s) => (
          <View key={s} style={[styles.dot, s === step ? styles.dotActive : null]} />
        ))}
      </View>

      {step === 'chibi' ? (
        <>
          <Txt weight="display" size={26}>
            Какой чибик твой?
          </Txt>
          <Txt muted>
            Чибики живут на главной: гуляют вместе, засыпают, когда вы спите, и показывают настроение. Нажми на чибика партнёра —
            придёт «думаю о тебе».
          </Txt>
          <View style={styles.preview}>
            <Chibi look={LOOKS[kind]} emotion="joy" value={70} pose="wave" size={140} />
          </View>
          <View style={styles.kinds}>
            {CHIBI_KINDS.map((k) => {
              const selected = k === kind;
              return (
                <Pressy
                  key={k}
                  onPress={() => setKind(k)}
                  style={styles.kindItem}
                  innerStyle={[styles.kindInner, selected ? styles.kindSelected : null]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={CHIBI_LABELS[k]}
                >
                  <Chibi look={LOOKS[k]} emotion="calm" value={30} pose="idle" size={64} still />
                  <Txt weight="heavy" size={12} center>
                    {CHIBI_LABELS[k]}
                  </Txt>
                </Pressy>
              );
            })}
          </View>
          <Txt faint size={12}>
            Причёски, глаза, рост и остальное можно будет настроить позже. Сменить чибика — в профиле.
          </Txt>
          <Button title="Это я" onPress={saveChibi} loading={busy} />
          <Button title="Выберу позже" variant="ghost" onPress={next} />
        </>
      ) : null}

      {step === 'push' ? (
        <>
          <Txt weight="display" size={26}>
            Уведомления
          </Txt>
          <Txt muted>
            Чтобы узнавать, когда партнёр думает о тебе, ответил на вопрос дня или исполнил твоё желание.
          </Txt>
          {needsInstall ? (
            <Card tint="rgba(255,194,102,0.12)">
              <Txt weight="heavy">Сначала добавь «Двое» на экран «Домой»</Txt>
              <Txt muted size={14}>
                На iPhone уведомления приходят только от сайта, открытого с экрана «Домой»: Safari → «Поделиться» → «На экран
                Домой». Потом открой «Двое» оттуда и включи уведомления в Профиль → Настройки.
              </Txt>
            </Card>
          ) : (
            <Button title="Включить уведомления" icon="bell" onPress={enablePush} loading={busy} />
          )}
          {pushNote ? (
            <Txt size={14} color={C.warn}>
              {pushNote}
            </Txt>
          ) : null}
          <Button title={needsInstall ? 'Понятно, дальше' : 'Позже'} variant="ghost" onPress={next} />
        </>
      ) : null}

      {step === 'sleep' ? (
        <>
          <Txt weight="display" size={26}>
            Сон — сам
          </Txt>
          <Txt muted>
            «Двое» может сама записывать сон: смотрит, когда ночью гас экран. Для этого нужен «Доступ к истории использования» — в
            списке выбери «Двое» и включи переключатель.
          </Txt>
          {access ? (
            <Card tint="rgba(94,211,160,0.14)">
              <Txt weight="heavy" color={C.good}>
                Доступ выдан — сон будет считаться сам
              </Txt>
            </Card>
          ) : (
            <Button title="Разрешить доступ" icon="sleep" onPress={() => ScreenSleep.openUsageAccessSettings()} />
          )}
          <Button title={access ? 'Готово' : 'Позже'} variant={access ? 'primary' : 'ghost'} onPress={finish} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 6, marginTop: S.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotActive: { width: 22, backgroundColor: C.accent },
  preview: { alignItems: 'center', paddingVertical: S.sm },
  kinds: { flexDirection: 'row', gap: S.sm },
  kindItem: { flex: 1 },
  kindInner: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: S.md,
    borderRadius: R.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  kindSelected: { borderColor: C.accent, backgroundColor: 'rgba(255,107,138,0.14)' },
});

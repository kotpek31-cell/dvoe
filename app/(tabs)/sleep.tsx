// Сон: автоопределение (Android — по экрану), ручная правка, кнопки «Иду спать» / «Проснулся», неделя.
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import * as ScreenSleep from '../../modules/screen-sleep';
import { BarChart } from '../../src/components/BarChart';
import { Icon } from '../../src/components/Icon';
import { TimeField } from '../../src/components/TimeField';
import { Button, Card, Empty, ErrorBox, Row, Screen, showError, Txt } from '../../src/components/ui';
import { usePair, useTableVersion } from '../../src/context/PairProvider';
import { deleteSleep, fetchRange, updateMyProfile, upsertSleep } from '../../src/lib/api';
import { addDays, atTime, formatDuration, formatHours, formatTime, rangeDays, todayKey, weekdayShort } from '../../src/lib/dates';
import { confirmAction } from '../../src/lib/dialogs';
import { requestSleepAccess } from '../../src/lib/healthkit';
import { useLoader } from '../../src/lib/hooks';
import { haptic } from '../../src/lib/motion';
import { autoSleepSupport, detectLastNight, type AutoSleepResult } from '../../src/lib/sleep';
import { refreshWidgets } from '../../src/lib/widgets';
import { C, S } from '../../src/theme';
import type { SleepEntry, SleepSource } from '../../src/types';

const SOURCE_LABEL: Record<SleepSource, string> = {
  android_screen: 'определено по экрану',
  healthkit: 'из Apple Health',
  manual: 'введено вручную',
  buttons: 'по кнопкам',
};

type Draft = { bed: Date; wake: Date };

// Время из пикера → конкретная дата: вечерние часы относятся к предыдущему дню
function bedFromPicked(day: string, picked: Date): Date {
  const base = picked.getHours() >= 12 ? addDays(day, -1) : day;
  return atTime(base, picked.getHours(), picked.getMinutes());
}

export default function SleepScreen() {
  const { me, partner, refresh: refreshProfiles } = usePair();
  const day = todayKey();
  const from = addDays(day, -6);
  const version = useTableVersion('sleep_entries', 'profiles');
  const { data, refreshing, error, refresh, reload } = useLoader(() => fetchRange(from, day), [from, day, version]);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState<AutoSleepResult | null>(null);
  const [hasAccess, setHasAccess] = useState(ScreenSleep.hasUsageAccess());
  const support = autoSleepSupport();
  const needsAccess = Platform.OS === 'android' && ScreenSleep.isAvailable && !hasAccess;

  // Вернулись из настроек Android — перепроверяем разрешение
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setHasAccess(ScreenSleep.hasUsageAccess());
    });
    return () => sub.remove();
  }, []);
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'android') setHasAccess(ScreenSleep.hasUsageAccess());
    }, []),
  );

  if (!me) return null;

  const sleeps = data?.sleeps ?? [];
  const mine = sleeps.find((s) => s.user_id === me.id && s.day === day) ?? null;
  const partnerSleep = partner ? sleeps.find((s) => s.user_id === partner.id && s.day === day) ?? null : null;
  const days = rangeDays(from, day);

  const save = async (bed: Date, wake: Date, source: SleepSource, durationMin?: number) => {
    const minutes = durationMin ?? Math.round((wake.getTime() - bed.getTime()) / 60_000);
    if (minutes < 30 || minutes > 20 * 60) {
      showError('Похоже на ошибку во времени: сон должен длиться от 30 минут до 20 часов.');
      return false;
    }
    setBusy(true);
    try {
      await upsertSleep({ userId: me.id, day, bed, wake, durationMin: minutes, source });
      haptic.success();
      reload();
      return true;
    } catch (e) {
      showError(e);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const runDetection = async () => {
    setBusy(true);
    try {
      if (Platform.OS === 'ios') await requestSleepAccess();
      const result = await detectLastNight(day, { askPermission: Platform.OS === 'ios' });
      setAuto(result);
      if (result.status === 'found' && (!mine || mine.source === 'android_screen' || mine.source === 'healthkit')) {
        await upsertSleep({
          userId: me.id,
          day,
          bed: result.sleep.bed,
          wake: result.sleep.wake,
          durationMin: result.sleep.durationMin,
          source: result.sleep.source,
        });
        reload();
      }
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const goToSleep = async () => {
    try {
      await updateMyProfile(me.id, { sleeping_since: new Date().toISOString() });
      await refreshProfiles();
      refreshWidgets();
      haptic.medium();
    } catch (e) {
      showError(e);
    }
  };

  const wakeUp = async () => {
    if (!me.sleeping_since) return;
    const bed = new Date(me.sleeping_since);
    const wake = new Date();
    const ok = await save(bed, wake, 'buttons');
    if (ok || wake.getTime() - bed.getTime() > 20 * 3600_000) {
      await updateMyProfile(me.id, { sleeping_since: null }).catch(showError);
      await refreshProfiles();
      refreshWidgets();
    }
  };

  const cancelSleep = async () => {
    await updateMyProfile(me.id, { sleeping_since: null }).catch(showError);
    await refreshProfiles();
    refreshWidgets();
  };

  const remove = (entry: SleepEntry) =>
    confirmAction(
      'Удалить запись о сне?',
      undefined,
      'Удалить',
      async () => {
        try {
          await deleteSleep(entry.id);
          reload();
        } catch (e) {
          showError(e);
        }
      },
      true,
    );

  const chartMax = Math.max(9, ...sleeps.map((s) => s.duration_min / 60));
  const avgOf = (userId: string) => {
    const list = sleeps.filter((s) => s.user_id === userId);
    return list.length ? Math.round(list.reduce((a, s) => a + s.duration_min, 0) / list.length) : null;
  };

  return (
    <Screen tabs title="Сон" subtitle="прошлая ночь и неделя" refreshing={refreshing} onRefresh={refresh}>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}

      {needsAccess ? (
        <Card tint="rgba(155,140,255,0.16)" style={styles.accessCard}>
          <Row gap={S.md}>
            <View style={styles.accessIcon}>
              <Icon name="phone" size={22} color={C.sleep} />
            </View>
            <Txt weight="heavy" size={16} style={styles.flex}>
              Пусть сон считается сам
            </Txt>
          </Row>
          <Txt size={14} muted>
            «Двое» видит, когда ночью гас экран, и сама записывает сон. Нужно одно разрешение: в списке выбери «Двое» и включи
            «Доступ к истории использования».
          </Txt>
          <Button title="Разрешить доступ" icon="check" onPress={() => ScreenSleep.openUsageAccessSettings()} />
        </Card>
      ) : null}

      <Card title="Прошлая ночь">
        {!data && !error ? <Empty text="Загружаем…" /> : null}
        {mine && !draft ? (
          <>
            <Txt weight="display" size={36} color={C.sleep}>
              {formatDuration(mine.duration_min)}
            </Txt>
            <Txt muted>
              {formatTime(mine.bed_time)} → {formatTime(mine.wake_time)} · {SOURCE_LABEL[mine.source]}
            </Txt>
            <Row gap={S.md}>
              <Button
                title="Изменить"
                variant="secondary"
                small
                style={styles.flex}
                onPress={() => setDraft({ bed: new Date(mine.bed_time), wake: new Date(mine.wake_time) })}
              />
              <Button title="Удалить" variant="danger" small style={styles.flex} onPress={() => remove(mine)} />
            </Row>
          </>
        ) : null}
        {data && !mine && !draft ? (
          <>
            <Empty text="Сон за эту ночь ещё не записан" />
            <Button
              title="Ввести вручную"
              variant="secondary"
              icon="edit"
              onPress={() => setDraft({ bed: atTime(addDays(day, -1), 23), wake: atTime(day, 7) })}
            />
          </>
        ) : null}
        {draft ? (
          <>
            <Row gap={S.md}>
              <TimeField label="Отбой" value={draft.bed} onChange={(d) => setDraft({ ...draft, bed: bedFromPicked(day, d) })} />
              <TimeField
                label="Подъём"
                value={draft.wake}
                onChange={(d) => setDraft({ ...draft, wake: atTime(day, d.getHours(), d.getMinutes()) })}
              />
            </Row>
            <Txt muted>Длительность: {formatDuration((draft.wake.getTime() - draft.bed.getTime()) / 60_000)}</Txt>
            <Row gap={S.md}>
              <Button title="Отмена" variant="secondary" style={styles.flex} onPress={() => setDraft(null)} />
              <Button
                title="Сохранить"
                style={styles.flex}
                loading={busy}
                onPress={async () => {
                  if (await save(draft.bed, draft.wake, 'manual')) setDraft(null);
                }}
              />
            </Row>
          </>
        ) : null}
      </Card>

      <Card title="Кнопки сна">
        {me.sleeping_since ? (
          <Txt>Ты спишь с {formatTime(me.sleeping_since)} — твой чибик прилёг на плед, партнёр это видит</Txt>
        ) : (
          <Txt muted size={14}>
            Нажми перед сном и после пробуждения — сон запишется точно, а твой чибик на главной ляжет спать.
          </Txt>
        )}
        <Row gap={S.md}>
          <Button
            title="Иду спать"
            icon="sleep"
            variant="secondary"
            style={styles.flex}
            disabled={Boolean(me.sleeping_since)}
            onPress={goToSleep}
          />
          <Button title="Проснулся" icon="sun" style={styles.flex} disabled={!me.sleeping_since} loading={busy} onPress={wakeUp} />
        </Row>
        {me.sleeping_since ? <Button title="Отменить «Иду спать»" variant="ghost" small onPress={cancelSleep} /> : null}
      </Card>

      {Platform.OS !== 'web' && support.supported && !needsAccess ? (
        <Card title={Platform.OS === 'ios' ? 'Apple Health' : 'Автоопределение'}>
          <Txt muted size={14}>
            {support.message}
          </Txt>
          <Button
            title={Platform.OS === 'ios' ? 'Загрузить сон из «Здоровья»' : 'Определить сон сейчас'}
            variant="secondary"
            loading={busy}
            onPress={runDetection}
          />
          {auto && auto.status !== 'found' ? (
            <Txt color={C.warn} size={14}>
              {auto.message}
            </Txt>
          ) : null}
          {auto && auto.status === 'found' ? (
            <Txt color={C.good} size={14}>
              Найдено: {formatTime(auto.sleep.bed)} → {formatTime(auto.sleep.wake)} ({formatDuration(auto.sleep.durationMin)})
              {mine && mine.source !== auto.sleep.source ? ' — твоя ручная запись не изменена' : ' — сохранено'}
            </Txt>
          ) : null}
        </Card>
      ) : null}

      {partner ? (
        <Card title={`Сон: ${partner.display_name}`}>
          {partner.sleeping_since ? <Txt>Спит с {formatTime(partner.sleeping_since)}</Txt> : null}
          {partnerSleep ? (
            <Txt>
              <Txt weight="displaySemi" size={20} color={C.partner}>
                {formatDuration(partnerSleep.duration_min)}
              </Txt>
              {'  '}
              {formatTime(partnerSleep.bed_time)} → {formatTime(partnerSleep.wake_time)}
            </Txt>
          ) : (
            <Empty text="Сегодняшний сон ещё не записан" />
          )}
        </Card>
      ) : null}

      <Card title="Неделя сна, часы">
        <BarChart
          max={chartMax}
          format={(v) => formatHours(v * 60)}
          series={[{ label: 'Ты', color: C.me }, ...(partner ? [{ label: partner.display_name, color: C.partner }] : [])]}
          groups={days.map((d) => ({
            label: weekdayShort(d),
            highlight: d === day,
            values: [
              (sleeps.find((s) => s.user_id === me.id && s.day === d)?.duration_min ?? NaN) / 60,
              ...(partner ? [(sleeps.find((s) => s.user_id === partner.id && s.day === d)?.duration_min ?? NaN) / 60] : []),
            ].map((v) => (Number.isFinite(v) ? v : null)),
          }))}
        />
        <Txt muted size={14}>
          В среднем: ты — {formatDuration(avgOf(me.id))}
          {partner ? `, ${partner.display_name} — ${formatDuration(avgOf(partner.id))}` : ''}
        </Txt>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  accessCard: { borderColor: 'rgba(155,140,255,0.45)' },
  accessIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(155,140,255,0.2)',
  },
});

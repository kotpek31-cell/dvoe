// Панель выбора локации: карточки (список прокручивается) с маленькой картинкой места в текущем времени суток.
// Локация одна на пару: сменил один — второй сразу видит то же место.
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { usePair } from '../context/PairProvider';
import { setLocation } from '../lib/api';
import { LOCATIONS, type LocationId } from '../lib/locations';
import { haptic } from '../lib/motion';
import type { DayTime } from '../lib/scene';
import { C, R, S } from '../theme';
import { Icon } from './Icon';
import { Location } from './scene/Location';
import { Sheet } from './Sheet';
import { Pressy, Txt } from './ui';

const TIME_LABEL: Record<DayTime, string> = { day: 'днём', evening: 'вечером', night: 'ночью' };

export function LocationSheet({ visible, onClose, current, time, onError }: {
  visible: boolean;
  onClose: () => void;
  current: LocationId;
  time: DayTime;
  onError: (text: string) => void;
}) {
  const { patchPair, partner } = usePair();
  const { width, height } = useWindowDimensions();
  const [busy, setBusy] = useState<LocationId | null>(null);
  const cardW = Math.floor((Math.min(width, 560) - S.lg * 2 - S.md - 4) / 2); // 4 — рамка панели
  const cardH = Math.round(cardW * 0.62);
  // картинка целиком по высоте сцены, показываем середину — горизонт и место для чибиков
  const sceneH = Math.round((cardW * 844) / 390);

  const choose = async (id: LocationId) => {
    if (id === current) return onClose();
    setBusy(id);
    try {
      await setLocation(id);
      patchPair({ location: id });
      haptic.success();
      onClose();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Не получилось');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Где вы сегодня?">
      <Txt muted size={14}>
        Место одно на двоих{partner ? ` — ${partner.display_name} увидит его сразу` : ''}. Сейчас {TIME_LABEL[time]}.
      </Txt>
      <ScrollView style={{ maxHeight: Math.round(height * 0.6) }} contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {LOCATIONS.map((loc) => {
          const on = loc.id === current;
          return (
            <Pressy
              key={loc.id}
              onPress={() => choose(loc.id)}
              style={{ width: cardW }}
              innerStyle={[styles.card, { width: cardW }, on ? styles.cardOn : null]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={loc.name}
            >
              <View style={[styles.preview, { height: cardH }]}>
                {visible ? (
                  <View style={{ position: 'absolute', left: 0, top: -Math.round(sceneH * 0.38), width: cardW, height: sceneH }}>
                    <Location id={loc.id} width={cardW} height={sceneH} time={time} active={false} />
                  </View>
                ) : null}
                {on ? (
                  <View style={styles.check}>
                    <Icon name="check" size={16} color={C.onAccent} strokeWidth={3} />
                  </View>
                ) : null}
                {busy === loc.id ? (
                  <View style={styles.busy}>
                    <ActivityIndicator color="#FFFFFF" />
                  </View>
                ) : null}
              </View>
              <Txt weight="heavy" size={14} numberOfLines={1} style={styles.name}>
                {loc.name}
              </Txt>
            </Pressy>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.md, paddingBottom: S.sm },
  card: {
    borderRadius: R.lg,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.045)',
    overflow: 'hidden',
  },
  cardOn: { borderColor: C.accent },
  preview: { overflow: 'hidden', backgroundColor: '#1A1530' },
  name: { paddingHorizontal: 10, paddingVertical: 8 },
  check: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busy: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(10,6,20,0.45)', alignItems: 'center', justifyContent: 'center' },
});

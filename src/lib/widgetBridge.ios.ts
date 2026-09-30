// iOS: передаём снимок в виджет expo-widgets. Модуль грузим лениво — в Expo Go его нет.
import { isExpoGo } from './env';
import type { PartnerSnapshot } from './widgets';

export async function pushSnapshotToWidgets(snapshot: PartnerSnapshot): Promise<void> {
  if (isExpoGo) return;
  const { PartnerWidget } = require('../widgets/PartnerWidget.ios') as {
    PartnerWidget: { updateSnapshot: (props: PartnerSnapshot) => unknown };
  };
  await Promise.resolve(PartnerWidget.updateSnapshot(snapshot));
}

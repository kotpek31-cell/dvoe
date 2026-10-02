// Android: перерисовываем все экземпляры виджета «Партнёр». В Expo Go модуля нет.
import { isExpoGo } from './env';
import type { PartnerSnapshot } from './widgets';

export async function pushSnapshotToWidgets(snapshot: PartnerSnapshot): Promise<void> {
  if (isExpoGo) return;
  const { requestWidgetUpdate } = require('react-native-android-widget');
  const { AndroidPartnerWidget } = require('../widgets/AndroidPartnerWidget') as typeof import('../widgets/AndroidPartnerWidget');
  await requestWidgetUpdate({
    widgetName: 'Partner',
    renderWidget: (info: { width: number; height: number }) => <AndroidPartnerWidget snapshot={snapshot} width={info.width} height={info.height} />,
    widgetNotFound: () => undefined,
  });
}

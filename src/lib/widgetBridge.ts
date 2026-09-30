// Веб и прочие платформы: виджетов на главном экране нет.
// Версии для телефонов — widgetBridge.ios.ts и widgetBridge.android.tsx (Metro выбирает файл по платформе).
import type { PartnerSnapshot } from './widgets';

export async function pushSnapshotToWidgets(_snapshot: PartnerSnapshot): Promise<void> {
  return undefined;
}

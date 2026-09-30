import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { loadSnapshotWithFallback } from '../lib/widgets';
import { AndroidPartnerWidget } from './AndroidPartnerWidget';

// Вызывается системой Android: при добавлении виджета, по таймеру (раз в 30 мин) и при изменении размера.
// Работает в фоне без открытого приложения — сам берёт свежие данные из Supabase.
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const snapshot = await loadSnapshotWithFallback();
      props.renderWidget(<AndroidPartnerWidget snapshot={snapshot} />);
      break;
    }
    case 'WIDGET_DELETED':
    case 'WIDGET_CLICK':
    default:
      break;
  }
}

// Диалоги, которые работают везде: в браузере Alert из React Native ничего не показывает,
// поэтому в веб-версии используем стандартные окна браузера.
import { Alert, Platform } from 'react-native';

type BrowserDialogs = { alert(text: string): void; confirm(text: string): boolean };
const browser = globalThis as unknown as BrowserDialogs;

const join = (title: string, message?: string) => (message ? `${title}\n\n${message}` : title);

export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    browser.alert(join(title, message));
    return;
  }
  Alert.alert(title, message);
}

export function confirmAction(
  title: string,
  message: string | undefined,
  okText: string,
  onConfirm: () => void,
  destructive = false,
): void {
  if (Platform.OS === 'web') {
    if (browser.confirm(join(title, message))) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Отмена', style: 'cancel' },
    { text: okText, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}

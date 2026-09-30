// Фоновое обновление виджетов (раз в 30+ минут, когда разрешит система).
// defineTask должен выполняться при загрузке JS — поэтому файл импортируется в index.ts.
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { isExpoGo } from './env';
import { refreshWidgets } from './widgets';

export const WIDGET_REFRESH_TASK = 'dvoe-widget-refresh';

TaskManager.defineTask(WIDGET_REFRESH_TASK, async () => {
  try {
    await refreshWidgets();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundRefresh(): Promise<void> {
  if (isExpoGo) return;
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
  if (await TaskManager.isTaskRegisteredAsync(WIDGET_REFRESH_TASK)) return;
  await BackgroundTask.registerTaskAsync(WIDGET_REFRESH_TASK, { minimumInterval: 30 });
}

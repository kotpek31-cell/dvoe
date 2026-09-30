// Обработчик Android-виджета регистрируется при загрузке JS (в том числе в фоне без UI).
// require внутри try — чтобы в Expo Go (где нет нативной части виджета) приложение не падало.
try {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./widget-task-handler');
  registerWidgetTaskHandler(widgetTaskHandler);
} catch (error) {
  console.warn('[widget] Android-виджет недоступен в этой сборке (например, в Expo Go)', error);
}

export {};

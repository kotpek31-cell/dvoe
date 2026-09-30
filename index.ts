// Точка входа: запускает Expo Router, регистрирует фоновую задачу
// и обработчик Android-виджета (файлы выбираются по платформе: .android / .web).
import 'expo-router/entry';
import './src/lib/backgroundTask';
import './src/widgets/registerAndroidWidget';

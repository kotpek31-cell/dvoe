// Ленивая загрузка HealthKit только в iOS-бандле.
export function loadHealthKitModule(): unknown {
  return require('@kingstinct/react-native-healthkit');
}

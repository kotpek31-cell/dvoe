// Основные настройки приложения — в app.json. Здесь только то, что зависит от файлов на месте сборки.
//
// Push на Android работает через Firebase (FCM): нужен файл google-services.json
// (Firebase → Project settings → Your apps → Android com.gaster.dvoe → google-services.json).
// Положи его в Codespace рядом с package.json: в GitHub он не попадёт (.gitignore), а в EAS Build попадёт (.easignore).
// Можно и так: expo.dev → проект → Environment variables → файл GOOGLE_SERVICES_JSON.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const local = path.join(__dirname, 'google-services.json');
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || (fs.existsSync(local) ? './google-services.json' : undefined);
  if (!googleServicesFile) return config;
  return { ...config, android: { ...config.android, googleServicesFile } };
};

#!/usr/bin/env bash
# Установка «Двое» одной командой (запускать в GitHub Codespaces или на любом компьютере с Node.js):
#   bash setup.sh
# Скрипт: применяет SQL-схему к Supabase, записывает ключи, ставит зависимости,
# отправляет проект в GitHub (оттуда сама собирается веб-версия) и по желанию собирает APK.
set -euo pipefail
cd "$(dirname "$0")"

say()  { printf '\n\033[1;35m▶ %s\033[0m\n' "$1"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$1"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$1"; }

say "1/5. Данные Supabase"
echo "Откройте Supabase → кнопка «Connect» → вкладка «Session pooler» → скопируйте строку (URI)."
echo "Вместо [YOUR-PASSWORD] должен стоять пароль базы, который вы придумали при создании проекта."
read -r -p "Строка подключения: " DB_URL
if [[ "$DB_URL" == *"[YOUR-PASSWORD]"* ]]; then
  read -r -s -p "Пароль базы данных (символы не отображаются): " DB_PASS; echo
  ENC_PASS="$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$DB_PASS")"
  DB_URL="${DB_URL//\[YOUR-PASSWORD\]/$ENC_PASS}"
fi
REF=""
if [[ "$DB_URL" =~ postgres\.([a-z0-9]+): ]]; then REF="${BASH_REMATCH[1]}"; fi
if [[ -z "$REF" && "$DB_URL" =~ @db\.([a-z0-9]+)\.supabase\.co ]]; then REF="${BASH_REMATCH[1]}"; fi
if [[ -z "$REF" ]]; then
  read -r -p "Не удалось узнать id проекта. Введите Project URL (https://xxxx.supabase.co): " SUPA_URL
else
  SUPA_URL="https://${REF}.supabase.co"
fi
echo "Project Settings → API Keys → Publishable key (начинается с sb_publishable_)."
read -r -p "Publishable key: " SUPA_KEY
[[ ${#SUPA_KEY} -gt 20 ]] || { echo "Ключ слишком короткий — проверьте, что скопирован целиком."; exit 1; }

say "2/5. Создаю таблицы в Supabase"
if ! command -v psql >/dev/null 2>&1; then
  sudo apt-get update -qq >/dev/null && sudo apt-get install -y -qq postgresql-client >/dev/null
fi
if psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f supabase/schema.sql >/tmp/dvoe-schema.log 2>&1; then
  ok "Схема применена (таблицы, права доступа, вопросы дня)"
else
  tail -5 /tmp/dvoe-schema.log
  warn "Не получилось подключиться к базе. Частые причины: неверный пароль или выбрана «Direct connection» вместо «Session pooler»."
  warn "Можно выполнить supabase/schema.sql вручную в SQL Editor и запустить скрипт ещё раз."
  exit 1
fi

say "3/5. Ключи и зависимости"
printf 'EXPO_PUBLIC_SUPABASE_URL=%s\nEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=%s\n' "$SUPA_URL" "$SUPA_KEY" > .env
ok "Файл .env записан ($SUPA_URL)"
npm install --no-audit --no-fund
npx --yes expo install react-dom react-native-web @expo/metro-runtime
npx --yes expo install --fix
ok "Зависимости установлены"

say "4/5. Отправляю проект в GitHub — оттуда сама соберётся веб-версия"
git add -A
git commit -q -m "Двое: проект и настройки" || true
if git push -q 2>/dev/null; then ok "Проект в GitHub"; else warn "git push не удался — проверьте, что Codespace открыт из вашего репозитория"; fi
REPO_SLUG="$(git config --get remote.origin.url | sed -E 's#^.*github\.com[:/]##; s#\.git$##')"
OWNER="${REPO_SLUG%%/*}"; NAME="${REPO_SLUG##*/}"
if command -v gh >/dev/null 2>&1 && gh api -X POST "repos/$REPO_SLUG/pages" -f build_type=workflow >/dev/null 2>&1; then
  ok "GitHub Pages включён"
  gh workflow run web.yml >/dev/null 2>&1 || true
else
  warn "Включите сайт вручную (один раз): репозиторий → Settings → Pages → Source: GitHub Actions,"
  warn "затем Actions → «Веб-версия» → Run workflow."
fi
if [[ "$NAME" == *.github.io ]]; then SITE="https://$NAME/"; else SITE="https://$OWNER.github.io/$NAME/"; fi
ok "Сайт появится через 3–5 минут: $SITE"
echo "   Если не появился: Actions → «Веб-версия» → Run workflow."
echo "   iPhone: откройте в Safari → «Поделиться» → «На экран Домой»."

say "5/5. APK для Android"
read -r -p "Собрать APK сейчас? Понадобится аккаунт expo.dev (y/n): " BUILD
if [[ "$BUILD" =~ ^[YyДд] ]]; then
  npm install -g eas-cli --no-audit --no-fund >/dev/null
  eas whoami >/dev/null 2>&1 || eas login
  grep -q '"projectId"' app.json || eas init
  git add -A && git commit -q -m "EAS project id" || true
  git push -q || true
  echo "На вопросы EAS отвечайте Enter / Y (он сам создаст ключ подписи)."
  eas build -p android --profile preview --no-wait
  ok "Сборка запущена. Ссылка на APK появится на expo.dev → Projects → dvoe → Builds (≈10–30 минут)."
else
  echo "Позже: eas build -p android --profile preview"
fi

say "Готово"
echo "Осталось в Supabase: Authentication → Sign In / Providers → выключить «Confirm email»."
echo "После этого регистрируйтесь: один нажимает «Создать пару», второй вводит код."

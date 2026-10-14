# Findly

Мессенджер (Discord × Telegram): личные чаты, группы и каналы с модерацией, друзья, голосовые, медиа, поиск Findline.
Работает как сайт (ПК и телефон) и как приложение для Android.

## Стек
- **Frontend:** React 19 + Vite + MUI 9 (Material 3 и iOS-стиль, настройки оформления как в Telegram iOS)
- **Backend:** [Supabase](https://supabase.com) — Postgres, Auth, Storage, Realtime (бесплатный тариф)
- **Хостинг сайта:** GitHub Pages (через GitHub Actions)
- **Android:** Capacitor 8 (папка `android/`) — см. **[ANDROID.md](./ANDROID.md)**

> GitHub Pages хранит только файлы сайта. Пользователи, сообщения и файлы лежат в Supabase.

## Быстрый старт
```bash
npm install
cp .env.example .env     # впишите ключи Supabase (Project Settings → API)
npm run dev              # http://localhost:5173
```
Требуется Node.js 22+.

## База данных (Supabase)
В Supabase → SQL Editor вставьте **весь** файл `supabase-setup.sql` и нажмите Run.
Скрипт можно запускать повторно после каждого обновления — он безопасен для повторного запуска.
Он создаёт таблицы, политики доступа (RLS), функции модерации и хранилища аватарок/вложений.

## Публикация сайта на GitHub Pages
1. Репозиторий → Settings → Pages → Source: **GitHub Actions**.
2. Settings → Secrets and variables → Actions: `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`
   (если секреты лежат в Environment `github-pages` — это тоже работает, workflow его использует).
3. Любой push в `main` запускает сборку (вкладка Actions).

## Приложение для Android
Подробная инструкция — [ANDROID.md](./ANDROID.md). Самый простой путь: GitHub → Actions → **Build Android APK** → Run workflow → скачать APK из Artifacts (ничего не нужно настраивать на своём компьютере). Альтернатива — локальная сборка в Android Studio (`npm run android:sync` → `npm run android:open`).

## Структура
```
src/
  theme/         — токены цвета (Material 3 и iOS), ThemeProvider, обои, акценты
  components/    — общие компоненты; ios/ — элементы iOS-стиля
  features/
    auth/ profile/ chats/ friends/ groups/ settings/
  MainShell.jsx  — раскладки: ПК, телефон (Material), телефон (iOS)
  native.js      — отличия Android-приложения (кнопка «Назад», скачивание, системные панели)
android/         — проект Android Studio (Capacitor)
supabase-setup.sql
```

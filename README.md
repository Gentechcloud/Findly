# Findly

Кросс-платформенный веб-мессенджер (Discord × Telegram) с дизайном Material 3.

Текущий этап: **каркас проекта + дизайн-система (Этап 1)**. См. [`roadmap.md`](./roadmap.md)
для полного плана по остальным функциям (регистрация, чаты, группы, каналы,
звонки, стикеры, видеоредактор и т.д.).

## Стек

- **Frontend:** React 19 + Vite + MUI, кастомная тема на токенах Material 3
- **Backend:** [Supabase](https://supabase.com) — Postgres, Auth, Storage, Realtime (бесплатный тариф)
- **Хостинг:** GitHub Pages (статика) — на будущее легко переехать на свой домен/сервер
- **Звонки (будущий этап):** WebRTC + бесплатный TURN-сервер (Metered.ca / OpenRelay)

> ⚠️ GitHub Pages хостит **только статические файлы**. Он не может хранить базу
> пользователей, сообщения, файлы или обрабатывать WebSocket/WebRTC-соединения —
> для этого используется Supabase. Frontend на GitHub Pages обращается к Supabase
> по сети напрямую из браузера.

## Быстрый старт (локально)

```bash
npm install
cp .env.example .env   # впишите свои ключи Supabase (см. ниже)
npm run dev
```

Откроется на `http://localhost:5173`.

## Настройка Supabase

1. Зарегистрируйтесь на [supabase.com](https://supabase.com) и создайте новый проект (бесплатный тариф).
2. В **Project Settings → API** скопируйте `Project URL` и `anon public` ключ.
3. Вставьте их в `.env`:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
4. Таблицы БД (users, messages, chats, groups, channels, friends, notifications и т.д.)
   будут добавлены на этапе 2 вместе с SQL-миграциями и настройкой Row Level Security.

## Деплой на GitHub Pages (автоматически)

Репозиторий уже содержит workflow `.github/workflows/deploy.yml`, который при каждом
push в `main`:
1. собирает проект с правильным `base` путём (`/имя-репозитория/`);
2. подставляет секреты Supabase из настроек репозитория;
3. публикует `dist/` на GitHub Pages.

### Настройка (один раз):

1. Создайте репозиторий на GitHub и запушьте туда этот проект:
   ```bash
   git init
   git add .
   git commit -m "Findly: каркас проекта + дизайн-система Material 3"
   git branch -M main
   git remote add origin https://github.com/<ваш-логин>/<имя-репозитория>.git
   git push -u origin main
   ```
2. В репозитории: **Settings → Pages → Source** → выберите **GitHub Actions**.
3. В репозитории: **Settings → Secrets and variables → Actions → New repository secret**
   добавьте:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Сделайте любой push в `main` (или запустите workflow вручную во вкладке **Actions**) —
   через 1-2 минуты сайт будет доступен по адресу
   `https://<ваш-логин>.github.io/<имя-репозитория>/`.

Когда в будущем купите свой домен и сервер — просто смените `VITE_BASE_PATH` на `/`
и задеплойте `dist/` куда угодно (или замените Supabase на свой backend, весь
доступ к данным идёт через `src/lib/supabaseClient.js`).

## Структура проекта

```
src/
  theme/          — токены Material 3 (цвет/тип/форма), ThemeProvider, 16 акцентов
  components/common/ — переиспользуемые UI-компоненты (Waveform, Avatar, ...)
  lib/            — supabaseClient и прочие интеграции
  features/       — по одной папке на функцию продукта:
    auth/         — регистрация / вход (этап 2)
    profile/      — настройка профиля, редактор профиля, Instagram-style лента (этап 3, 9)
    chats/        — список чатов, окно чата, Findline-поиск (этап 4, 5, 6)
    friends/      — система друзей, Mail (центр уведомлений) (этап 7)
    groups/       — группы, роли, мут, лимит скорости (этап 6)
    channels/     — каналы, лайки/дизлайки, комментарии (этап 6)
    settings/     — безопасность, приватность, оформление, вход (этап 8)
    stickers/     — стикеры и паки (этап 11)
    videoEditor/  — видеоредактор (этап 10)
  pages/          — сборка features в маршруты (react-router)
```

## Скрипты

- `npm run dev` — локальная разработка
- `npm run build` — production-сборка в `dist/`
- `npm run preview` — локальный просмотр production-сборки

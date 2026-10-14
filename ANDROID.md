# Findly для Android — как получить APK

Приложение — это тот же Findly, упакованный в настоящее Android-приложение (Capacitor):
своя иконка, экран загрузки, кнопка «Назад», микрофон и камера, без адресной строки браузера.
Есть **два способа получить APK**. Начните со способа А — он не требует ни Java, ни Gradle, ни Android Studio.

---

## Способ А (рекомендую): собрать APK в облаке GitHub

GitHub соберёт файл на своём сервере, где всё уже настроено правильно. Ваш компьютер для этого не нужен.

1. Распакуйте архив поверх папки `findly` (файл `.env` остаётся на месте).
2. В GitHub Desktop: **Commit to main** → **Push origin**.
3. Откройте ваш репозиторий на github.com → вкладка **Actions**.
4. Слева выберите **Build Android APK** → справа кнопка **Run workflow** → снова **Run workflow** (зелёная).
5. Подождите 6–12 минут. Когда у запуска появится зелёная галочка ✅, нажмите на него.
6. Внизу страницы в разделе **Artifacts** нажмите **findly-android-apk** — скачается zip.
7. Распакуйте его — внутри файл `app-debug.apk`. Перекиньте на телефон (Telegram «Избранное», Google Диск, кабель),
   откройте и разрешите «Установку из этого источника».

**Как обновлять:** любые изменения → Commit + Push → снова шаги 3–7. Новая версия ставится **поверх** старой,
вход и данные сохраняются (все сборки подписаны одним ключом, номер версии растёт сам).

Если запуск закончился красным крестиком ❌: нажмите на него → откройте красный шаг → скопируйте последние строки
ошибки и пришлите мне.

> Ключи Supabase берутся из тех же секретов GitHub, что и для сайта (Settings → Environments → github-pages).

---

## Способ Б: собрать на своём компьютере в Android Studio

Нужен, если хотите запускать приложение на телефоне по кабелю и сразу видеть изменения.

### Подготовка (один раз)
1. **Node.js 22+** (nodejs.org → LTS). Проверка: `node -v` → `v22…` или выше.
2. **Android Studio — самая свежая версия** (developer.android.com/studio). Проект требует Narwhal 3 (2025.1.3) или новее.
   Если у вас старая — обновите (Android Studio → About → Check for updates), иначе будут ошибки про версию Gradle/Java.
3. При первом запуске Studio выберите «Standard» и согласитесь на загрузку Android SDK.

### Каждый раз, когда обновили файлы
В Терминале, в папке `findly`:

```bash
npm install
npm run android:sync     # собрать сайт и положить внутрь Android-проекта (нужен файл .env!)
npm run android:open     # открыть проект в Android Studio
```
(Если `android:open` не сработал: Android Studio → File → Open → выберите **папку `android`** внутри `findly`, а не саму `findly`.)

### ВАЖНО: настройте Java (это причина 90% ошибок «не та Java / не тот Gradle»)
1. Android Studio → **Settings** (на Mac: `⌘ ,`) → Build, Execution, Deployment → Build Tools → **Gradle**.
2. В поле **Gradle JDK** выберите **`jbr-21`** (встроенная в Studio Java 21).
   Если такого пункта нет: выберите **Download JDK…** → Version **21** → Vendor **JetBrains Runtime** (или Eclipse Temurin) → Download.
3. Нажмите **Apply → OK**. Затем File → **Sync Project with Gradle Files**.

Нужна именно **Java 21**: Java 8, 11 и 17 слишком старые, а 22+ (например, 25) слишком новые для этого проекта.
Не запускайте `./gradlew` в Терминале — он берёт системную Java и ломается. Собирайте только из меню Android Studio.
Если Studio предложит «Upgrade Gradle / Android Gradle Plugin» — отказывайтесь (кнопки «Not now» / «Don't ask again»).

### Сборка APK
Подождите, пока внизу закончится Gradle sync (первый раз 5–15 минут). Затем меню **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
Появится «APK(s) generated» → ссылка **locate**. Файл: `findly/android/app/build/outputs/apk/debug/app-debug.apk`.

Запуск на телефоне по кабелю: «Настройки → О телефоне» → 7 раз на «Номер сборки» → «Для разработчиков» → «Отладка по USB»;
подключите кабель, выберите телефон вверху Studio и нажмите зелёный ▶.

### Таблица ошибок

| Текст ошибки | Что делать |
|---|---|
| `Dependency requires at least JVM runtime version 21. This build uses a Java 17 JVM` | Gradle JDK → **jbr-21** (см. выше) |
| `Android Gradle plugin requires Java 17 to run. You are currently using Java 11` (или 8) | Gradle JDK → **jbr-21** |
| `Unsupported class file major version 69` / `Could not determine java version from '25'` | Java слишком новая. Gradle JDK → **21** |
| `The project is using an incompatible version of the Android Gradle plugin` / `Minimum supported Gradle version…` | Android Studio слишком старая — обновите до свежей версии |
| `SDK location not found` | Создайте файл `android/local.properties` со строкой `sdk.dir=/Users/ВАШЕ_ИМЯ/Library/Android/sdk` (путь виден в Settings → Android SDK → «Android SDK Location») |
| `Failed to find Build Tools revision 36.0.0` или `licenses have not been accepted` | Settings → Android SDK → вкладка SDK Platforms: отметьте **Android 16 (API 36)**; вкладка SDK Tools: **Android SDK Build-Tools 36**; Apply и примите лицензии |
| `Could not GET https://dl.google.com/…`, `services.gradle.org`, `Read timed out` | Нет доступа к серверам Google/Gradle. Включите VPN на время первой синхронизации, затем File → Sync Project with Gradle Files. После загрузки VPN не нужен |
| Странные ошибки после смены настроек | File → **Invalidate Caches… → Invalidate and Restart**; удалите папки `android/.gradle`, `android/build`, `android/app/build`; снова Sync |
| `The Capacitor CLI requires NodeJS >=22` | Обновите Node.js до 22+ |
| В приложении «Failed to fetch» | Не было файла `.env` рядом с `package.json` в момент `npm run android:sync` |
| Белый экран / «Unable to load asset» | Не выполнили `npm run android:sync` |

Если ошибка не из таблицы — пришлите **скриншот Gradle-ошибки целиком** (вкладка Build внизу Studio) и скажите версию Android Studio (Android Studio → About).

---

## Про подпись и безопасность
Ключ подписи `android/app/findly.keystore` лежит в проекте (пароль `findly-key`) — так все сборки подписаны одинаково и ставятся друг поверх друга.
Для личного использования и тестов этого достаточно. Если вы решите раздавать приложение широко или выкладывать в Google Play,
создайте **собственный приватный ключ** (Build → Generate Signed App Bundle / APK), храните его вне репозитория и не теряйте.

## Что отличается в приложении от сайта
* По умолчанию включён **iOS-стиль** (меняется в Настройки → Оформление). На ПК остаётся прежний вид.
* Кнопка «Назад» закрывает окно/чат по очереди и только потом сворачивает приложение.
* «Скачать» файл/фото открывает ссылку в системном браузере, оттуда файл сохраняется; «Скачать .txt» открывает меню «Поделиться».
* Микрофон и камера спрашивают разрешение при первом использовании (потом — Настройки телефона → Приложения → Findly → Разрешения).

## Необязательно: обновления без переустановки APK
Можно сделать так, чтобы приложение каждый раз загружало **живой сайт с GitHub Pages**: тогда после Commit → Push новая версия
появляется без новой сборки APK. В `capacitor.config.json` добавьте блок `server` (замените `ЛОГИН`):

```json
{
  "appId": "com.findly.app",
  "appName": "Findly",
  "webDir": "dist",
  "server": { "url": "https://ЛОГИН.github.io/Findly/" }
}
```
Затем соберите APK один раз (способ А или Б). Минусы: нужен интернет даже для запуска. Этот режим я на реальном телефоне не проверял;
если что-то странно — удалите блок `server` и пересоберите.

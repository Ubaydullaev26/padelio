# @padelio/miniapp

Telegram Mini App (React + Vite + Tailwind 4). Спецификации экранов: `docs/16-screen-specs.md`.

Готово (каркас, Sprint 1): автоавторизация через `initData` → JWT, тема Telegram через CSS-переменные, i18n uz/ru, роутинг (HashRouter), список клубов и карточка клуба из API, нижняя навигация, dev-режим в обычном браузере (без сессии).

Дальше (Sprint 2): выбор слота, hold, оплата, «Мои брони» с данными.

## Запуск

```bash
pnpm --filter @padelio/miniapp dev   # :5173, /api проксируется на :3000
```

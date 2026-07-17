# @padelio/bot

Telegram-бот (grammY). Тонкий по архитектуре (docs/08 §3): `/start` с deep-links (`club_…`, `res_…`, `ref_…`, `match_…`), кнопка входа в Mini App, i18n uz/ru.

## Запуск

```bash
# .env в корне: BOT_TOKEN (от @BotFather) и MINIAPP_URL (публичный HTTPS Mini App)
pnpm --filter @padelio/bot dev
```

Доставка уведомлений (подтверждения, напоминания) — отдельный консюмер BullMQ, появится в Sprint 2.

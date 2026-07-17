import { Bot, InlineKeyboard } from 'grammy';
import { botLang, messages } from './i18n.js';

/**
 * Тонкий бот (docs/08 §3): вход в Mini App + deep-links.
 * Уведомления будут доставляться отдельным консюмером очереди BullMQ (Sprint 2),
 * этот процесс отвечает только за диалоговые команды.
 */
const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('BOT_TOKEN is not set (get one from @BotFather, see .env.example)');
  process.exit(1);
}
const miniappUrl = process.env.MINIAPP_URL;
if (!miniappUrl) {
  console.error('MINIAPP_URL is not set (public HTTPS URL of the Mini App)');
  process.exit(1);
}

const bot = new Bot(token);

bot.command('start', async (ctx) => {
  const lang = botLang(ctx.from?.language_code);
  const t = messages[lang];
  // Deep-link payload (docs/04 §1): club_{id} | res_{id} | ref_{code} | match_{id}.
  // Прокидываем в Mini App как startapp-параметр через query — приложение разберёт.
  const startParam = typeof ctx.match === 'string' && ctx.match ? ctx.match : undefined;
  const url = startParam
    ? `${miniappUrl}?startapp=${encodeURIComponent(startParam)}`
    : miniappUrl;
  const keyboard = new InlineKeyboard().webApp(t.open, url);
  await ctx.reply(t.welcome, { reply_markup: keyboard });
});

bot.command('help', async (ctx) => {
  await ctx.reply(messages[botLang(ctx.from?.language_code)].help);
});

bot.catch((err) => {
  console.error('Bot error:', err.error);
});

void bot.start({ onStart: (me) => console.log(`Bot @${me.username} started`) });

export type BotLang = 'uz' | 'ru';

export const messages: Record<BotLang, { welcome: string; open: string; help: string }> = {
  ru: {
    welcome:
      'Привет! 🎾 Padelio — бронирование падел-кортов Ташкента за 30 секунд.\n\n' +
      'Все клубы города, живое расписание, оплата внутри Telegram.',
    open: 'Открыть Padelio',
    help: 'Откройте приложение кнопкой ниже. Вопросы: @padelio_support',
  },
  uz: {
    welcome:
      "Salom! 🎾 Padelio — Toshkentdagi padel kortlarini 30 soniyada band qilish.\n\n" +
      "Shahardagi barcha klublar, jonli jadval, Telegram ichida to'lov.",
    open: 'Padelio-ni ochish',
    help: 'Quyidagi tugma orqali ilovani oching. Savollar: @padelio_support',
  },
};

export function botLang(languageCode: string | undefined): BotLang {
  return languageCode?.startsWith('uz') ? 'uz' : 'ru';
}

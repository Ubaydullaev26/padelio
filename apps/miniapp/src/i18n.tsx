import { createContext, useContext, useState, type ReactNode } from 'react';
import { deviceLanguage } from './telegram';

export type Lang = 'uz' | 'ru';

const dict = {
  ru: {
    play: 'Играть',
    bookings: 'Мои брони',
    profile: 'Профиль',
    clubs_title: 'Клубы Ташкента',
    courts: 'кортов',
    from: 'от',
    per_hour: '/час',
    no_clubs: 'Клубы скоро появятся',
    loading: 'Загрузка…',
    error_retry: 'Ошибка загрузки. Повторить',
    no_bookings: 'Пока нет броней',
    find_court: 'Найти корт',
    indoor: 'крытый',
    outdoor: 'открытый',
    panoramic: 'панорамное стекло',
    call: 'Позвонить',
    telegram: 'Telegram',
    dev_mode: 'Режим разработки: откройте через Telegram для входа',
    language: 'Язык',
  },
  uz: {
    play: "O'ynash",
    bookings: 'Bronlarim',
    profile: 'Profil',
    clubs_title: 'Toshkent klublari',
    courts: 'kort',
    from: 'dan',
    per_hour: '/soat',
    no_clubs: 'Klublar tez orada paydo bo‘ladi',
    loading: 'Yuklanmoqda…',
    error_retry: 'Xatolik. Qayta urinish',
    no_bookings: 'Hozircha bronlar yo‘q',
    find_court: 'Kort topish',
    indoor: 'yopiq',
    outdoor: 'ochiq',
    panoramic: 'panoramik oyna',
    call: "Qo'ng'iroq qilish",
    telegram: 'Telegram',
    dev_mode: 'Dev-rejim: kirish uchun Telegram orqali oching',
    language: 'Til',
  },
} satisfies Record<Lang, Record<string, string>>;

export type TKey = keyof (typeof dict)['ru'];

const I18nContext = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: TKey) => string;
}>({ lang: 'ru', setLang: () => undefined, t: (k) => k });

export function I18nProvider({ children }: { children: ReactNode }) {
  const initial = deviceLanguage();
  const [lang, setLang] = useState<Lang>(initial === 'uz' ? 'uz' : 'ru');
  const t = (k: TKey) => dict[lang][k];
  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useT() {
  return useContext(I18nContext);
}

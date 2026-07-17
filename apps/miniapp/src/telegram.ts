/**
 * Тонкая типизированная обёртка над window.Telegram.WebApp.
 * Сознательно без внешнего SDK на этапе каркаса (меньше зависимостей);
 * при необходимости заменим на @telegram-apps/sdk-react — интерфейс совместим.
 */

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: { id: number; first_name?: string; language_code?: string };
    start_param?: string;
  };
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  ready(): void;
  expand(): void;
  requestContact?(callback: (shared: boolean) => void): void;
  MainButton: {
    setText(text: string): void;
    show(): void;
    hide(): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function tg(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp;
}

/** initData есть только внутри Telegram; в браузере — dev-режим без авторизации. */
export function getInitData(): string {
  return tg()?.initData ?? '';
}

export function isInsideTelegram(): boolean {
  return Boolean(getInitData());
}

export function initTelegram(): void {
  const app = tg();
  if (!app) return;
  app.ready();
  app.expand();
  // Прокидываем тему Telegram в CSS-переменные (docs/16: тёмная/светлая тема)
  const root = document.documentElement;
  root.dataset.scheme = app.colorScheme;
  for (const [key, value] of Object.entries(app.themeParams)) {
    root.style.setProperty(`--tg-${key.replace(/_/g, '-')}`, value);
  }
}

export function deviceLanguage(): 'uz' | 'ru' | 'en' {
  const code = tg()?.initDataUnsafe.user?.language_code ?? navigator.language;
  if (code.startsWith('uz')) return 'uz';
  if (code.startsWith('en')) return 'en';
  return 'ru';
}

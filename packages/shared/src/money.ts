/**
 * Деньги храним в минорных единицах (тийины): 1 сум = 100 тийинов (docs/09).
 * bigint в БД ↔ number/bigint в приложении; здесь — только форматирование.
 */
export const TIYIN_PER_SUM = 100;

export function tiyinToSum(tiyin: bigint | number): number {
  return Number(tiyin) / TIYIN_PER_SUM;
}

/** «30 000 000 тийинов» → «300 000 сум» */
export function formatSum(tiyin: bigint | number, locale: 'uz' | 'ru' | 'en' = 'ru'): string {
  const sum = tiyinToSum(tiyin);
  const formatted = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(sum);
  const currency = locale === 'en' ? 'UZS' : locale === 'uz' ? "so'm" : 'сум';
  return `${formatted} ${currency}`;
}

import { Link } from 'react-router-dom';
import { useT } from '../i18n';

/** Заглушка: список броней подключится к API в Sprint 2 вместе с созданием брони. */
export function Bookings() {
  const { t } = useT();
  return (
    <div className="p-4 pb-20 flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="text-4xl mb-2">🎾</div>
      <p className="text-hint mb-4">{t('no_bookings')}</p>
      <Link to="/" className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-white">
        {t('find_court')}
      </Link>
    </div>
  );
}

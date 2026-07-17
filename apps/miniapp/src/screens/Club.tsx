import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { formatSum } from '@padelio/shared';
import { api, type ClubDetails } from '../api';
import { useT } from '../i18n';

export function Club() {
  const { slug } = useParams<{ slug: string }>();
  const { t, lang } = useT();
  const club = useQuery({
    queryKey: ['club', slug],
    queryFn: () => api<ClubDetails>(`/clubs/${slug}`),
    enabled: Boolean(slug),
  });

  if (club.isPending) return <div className="p-4 text-hint">{t('loading')}</div>;
  if (club.isError || !club.data)
    return (
      <div className="p-4">
        <button className="text-link" onClick={() => club.refetch()}>
          {t('error_retry')}
        </button>
      </div>
    );

  const c = club.data;
  const description = c.description[lang] ?? c.description.ru ?? '';
  const address = c.address[lang] ?? c.address.ru ?? '';

  return (
    <div className="p-4 pb-20">
      <Link to="/" className="text-link text-sm">
        ←
      </Link>
      <h1 className="text-xl font-bold mt-1">{c.name}</h1>
      <div className="text-sm text-hint mt-0.5">
        {c.ratingAvg !== null && <>★ {c.ratingAvg.toFixed(1)} ({c.ratingCount}) · </>}
        {c.district}
      </div>

      {description && <p className="mt-3 text-sm">{description}</p>}

      {c.priceFrom !== null && (
        <div className="mt-3 rounded-2xl bg-card p-4 font-medium text-accent">
          {t('from')} {formatSum(c.priceFrom, lang)}
          {t('per_hour')}
        </div>
      )}

      <div className="mt-3 space-y-2">
        {c.courts.map((court) => (
          <div key={court.id} className="rounded-2xl bg-card p-3 text-sm">
            <span className="font-medium">{court.name}</span>
            <span className="text-hint">
              {' '}
              · {court.indoor ? t('indoor') : t('outdoor')}
              {court.hasPanoramicGlass && <> · {t('panoramic')}</>}
            </span>
          </div>
        ))}
      </div>

      {address && <p className="mt-3 text-sm text-hint">{address}</p>}

      <div className="mt-3 flex gap-3">
        {c.phone && (
          <a href={`tel:${c.phone}`} className="text-link text-sm">
            {t('call')}
          </a>
        )}
        {c.telegramContact && (
          <a href={`https://t.me/${c.telegramContact.replace('@', '')}`} className="text-link text-sm">
            {t('telegram')}
          </a>
        )}
      </div>
      {/* Слоты и бронирование — Sprint 2 (docs/16 §3–4) */}
    </div>
  );
}

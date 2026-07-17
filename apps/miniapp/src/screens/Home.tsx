import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatSum } from '@padelio/shared';
import { api, type ClubListItem } from '../api';
import { useT } from '../i18n';
import { useAuth } from '../auth';

export function Home() {
  const { t, lang } = useT();
  const auth = useAuth();
  const clubs = useQuery({ queryKey: ['clubs'], queryFn: () => api<ClubListItem[]>('/clubs') });

  return (
    <div className="p-4 pb-20">
      <h1 className="text-xl font-bold mb-3">{t('clubs_title')}</h1>

      {auth.status === 'dev' && (
        <div className="mb-3 rounded-xl bg-card p-3 text-xs text-hint">{t('dev_mode')}</div>
      )}

      {clubs.isPending && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-card animate-pulse" />
          ))}
        </div>
      )}

      {clubs.isError && (
        <button className="text-link" onClick={() => clubs.refetch()}>
          {t('error_retry')}
        </button>
      )}

      {clubs.data?.length === 0 && <p className="text-hint">{t('no_clubs')}</p>}

      <div className="space-y-3">
        {clubs.data?.map((club) => (
          <Link
            key={club.id}
            to={`/club/${club.slug}`}
            className="block rounded-2xl bg-card p-4 active:opacity-80"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">{club.name}</span>
              {club.ratingAvg !== null && (
                <span className="text-sm">
                  ★ {club.ratingAvg.toFixed(1)}{' '}
                  <span className="text-hint">({club.ratingCount})</span>
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-hint">
              {club.district && <span>{club.district} · </span>}
              {club.courtsCount} {t('courts')}
            </div>
            {club.priceFrom !== null && (
              <div className="mt-1 text-sm font-medium text-accent">
                {t('from')} {formatSum(club.priceFrom, lang)}
                {t('per_hour')}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

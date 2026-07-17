import { useAuth } from '../auth';
import { useT, type Lang } from '../i18n';

export function Profile() {
  const { t, lang, setLang } = useT();
  const auth = useAuth();

  return (
    <div className="p-4 pb-20">
      <h1 className="text-xl font-bold mb-3">{t('profile')}</h1>

      {auth.status === 'authenticated' && auth.user && (
        <div className="rounded-2xl bg-card p-4 mb-3">
          <div className="font-semibold">{auth.user.firstName}</div>
          {auth.user.phone && <div className="text-sm text-hint">{auth.user.phone}</div>}
        </div>
      )}
      {auth.status === 'dev' && (
        <div className="rounded-2xl bg-card p-4 mb-3 text-sm text-hint">{t('dev_mode')}</div>
      )}

      <div className="rounded-2xl bg-card p-4">
        <div className="text-sm text-hint mb-2">{t('language')}</div>
        <div className="flex gap-2">
          {(['ru', 'uz'] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`rounded-xl px-4 py-1.5 text-sm ${
                lang === l ? 'bg-accent font-semibold text-white' : 'bg-bg'
              }`}
            >
              {l === 'ru' ? 'Русский' : 'Oʻzbekcha'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

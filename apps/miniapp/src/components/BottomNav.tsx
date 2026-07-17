import { NavLink } from 'react-router-dom';
import { useT } from '../i18n';

const tabs = [
  { to: '/', icon: '🎾', key: 'play' as const },
  { to: '/bookings', icon: '📅', key: 'bookings' as const },
  { to: '/profile', icon: '👤', key: 'profile' as const },
];

export function BottomNav() {
  const { t } = useT();
  return (
    <nav className="fixed bottom-0 inset-x-0 flex border-t border-hint/20 bg-bg pb-[env(safe-area-inset-bottom)]">
      {tabs.map(({ to, icon, key }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex-1 py-2 text-center text-xs ${isActive ? 'text-accent font-semibold' : 'text-hint'}`
          }
        >
          <div className="text-lg leading-none">{icon}</div>
          {t(key)}
        </NavLink>
      ))}
    </nav>
  );
}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth';
import { I18nProvider } from './i18n';
import { BottomNav } from './components/BottomNav';
import { Home } from './screens/Home';
import { Club } from './screens/Club';
import { Bookings } from './screens/Bookings';
import { Profile } from './screens/Profile';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

/** HashRouter: Mini App открывается с одного URL, deep-links передаются через startapp. */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <HashRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/club/:slug" element={<Club />} />
              <Route path="/bookings" element={<Bookings />} />
              <Route path="/profile" element={<Profile />} />
            </Routes>
            <BottomNav />
          </HashRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setSessionToken, type SessionUser } from './api';
import { getInitData, isInsideTelegram } from './telegram';

interface AuthState {
  status: 'loading' | 'authenticated' | 'dev' | 'error';
  user: SessionUser | null;
  startParam?: string;
}

const AuthContext = createContext<AuthState>({ status: 'loading', user: null });

/**
 * Автоавторизация при входе (docs/04 §1): initData → POST /api/auth/telegram → JWT.
 * Вне Telegram (браузер разработчика) — dev-режим без сессии: каталог доступен, бронь нет.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });

  useEffect(() => {
    if (!isInsideTelegram()) {
      setState({ status: 'dev', user: null });
      return;
    }
    api<{ token: string; user: SessionUser; startParam?: string }>('/auth/telegram', {
      method: 'POST',
      body: JSON.stringify({ initData: getInitData() }),
    })
      .then(({ token, user, startParam }) => {
        setSessionToken(token);
        setState({ status: 'authenticated', user, startParam });
      })
      .catch(() => setState({ status: 'error', user: null }));
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

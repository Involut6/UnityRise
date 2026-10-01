import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, clearCache, hasToken, setToken, setUnauthorizedHandler } from './api';

export type Role = 'member' | 'loan_manager' | 'accountant' | 'admin' | 'super_admin';
export interface Me {
  id: string; email: string; phone: string | null; role: Role; totp_enabled: boolean; member_id: string | null; membership_id: string | null;
  first_name: string | null; last_name: string | null; kyc_status: 'draft' | 'submitted' | 'approved' | 'rejected' | null; kyc_note: string | null; created_at: string; password_changed_at: string | null;
}
interface AuthCtx {
  me: Me | null; loading: boolean; isStaff: boolean; isAdmin: boolean; isMember: boolean; approved: boolean;
  signIn: (token: string) => Promise<void>; signOut: () => void; refresh: () => Promise<void>; can: (...roles: Role[]) => boolean;
  idleWarning: number | null; staySignedIn: () => Promise<void>;
}
const Ctx = createContext<AuthCtx>(null as never);
export const useAuth = () => useContext(Ctx);

const IDLE_MS = 15 * 60_000, WARN_S = 60;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null); const [loading, setLoading] = useState(hasToken());
  const [idleWarning, setIdleWarning] = useState<number | null>(null);
  const last = useRef(Date.now());

  const signOut = useCallback(() => { setToken(''); clearCache(); setMe(null); setIdleWarning(null); }, []);
  const refresh = useCallback(async () => { try { setMe(await api<Me>('GET', '/auth/me')); } catch { signOut(); } }, [signOut]);
  const signIn = useCallback(async (t: string) => { setToken(t); clearCache(); setLoading(true); await refresh(); setLoading(false); }, [refresh]);
  useEffect(() => { setUnauthorizedHandler(signOut); if (hasToken()) refresh().finally(() => setLoading(false)); }, [refresh, signOut]);

  // Session timeout: warn after inactivity, then sign out. "Stay signed in" mints a fresh token.
  useEffect(() => {
    if (!me) return;
    const bump = () => { if (idleWarning === null) last.current = Date.now(); };
    const evs = ['pointerdown', 'keydown', 'scroll'] as const; evs.forEach(e => window.addEventListener(e, bump, { passive: true }));
    const t = setInterval(() => {
      const idle = Date.now() - last.current;
      if (idle >= IDLE_MS + WARN_S * 1000) signOut();
      else if (idle >= IDLE_MS) setIdleWarning(Math.ceil((IDLE_MS + WARN_S * 1000 - idle) / 1000)); else setIdleWarning(null);
    }, 1000);
    return () => { evs.forEach(e => window.removeEventListener(e, bump)); clearInterval(t); };
  }, [me, idleWarning, signOut]);
  const staySignedIn = useCallback(async () => { const r = await api<{ token: string }>('POST', '/auth/refresh'); setToken(r.token); last.current = Date.now(); setIdleWarning(null); }, []);

  const value = useMemo<AuthCtx>(() => {
    const role = me?.role; const isStaff = !!role && role !== 'member'; const isAdmin = role === 'admin' || role === 'super_admin';
    return { me, loading, isStaff, isAdmin, isMember: !!me?.member_id, approved: me?.kyc_status === 'approved', signIn, signOut, refresh, idleWarning, staySignedIn,
      can: (...roles) => !!role && (role === 'super_admin' || roles.includes(role)) };
  }, [me, loading, signIn, signOut, refresh, idleWarning, staySignedIn]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

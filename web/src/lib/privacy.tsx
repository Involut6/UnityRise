import { ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { naira } from './format';

const KEY = 'ur.hideBalances';
export const MASK = '₦ ••••';
const Ctx = createContext<{ hidden: boolean; toggle: () => void }>({ hidden: false, toggle: () => {} });

/** Remembers (per browser) whether balances should be masked. Masked values are never rendered into the page. */
export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } });
  const toggle = useCallback(() => setHidden(h => { const n = !h; try { localStorage.setItem(KEY, n ? '1' : '0'); } catch { /* storage unavailable */ } return n; }), []);
  const value = useMemo(() => ({ hidden, toggle }), [hidden, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const usePrivacy = () => useContext(Ctx);

/** Like naira(), but returns a mask while balances are hidden. */
export function useMoney() {
  const { hidden } = usePrivacy();
  return useCallback((v: number | string | null | undefined, o?: { compact?: boolean; decimals?: boolean }) => (hidden ? MASK : naira(v, o)), [hidden]);
}

/** Renders text, or an accessible mask when hidden. */
export function Sensitive({ children }: { children: ReactNode }) {
  const { hidden } = usePrivacy();
  return hidden ? <span aria-label="Hidden">{MASK}</span> : <>{children}</>;
}

export function BalanceToggle({ className = '', onDark }: { className?: string; onDark?: boolean }) {
  const { hidden, toggle } = usePrivacy();
  return <button type="button" onClick={toggle} aria-pressed={hidden} aria-label={hidden ? 'Show balances' : 'Hide balances'} title={hidden ? 'Show balances' : 'Hide balances'}
    className={`grid size-10 place-items-center rounded-full transition ${onDark ? 'text-on-brand/85 hover:bg-white/15' : 'text-muted hover:bg-surface2 hover:text-ink'} ${className}`}>{hidden ? <EyeOff size={20} /> : <Eye size={20} />}</button>;
}

import { useCallback, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';
const current = (): Theme => {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/** Explicit choice is stored; until the user picks one we follow the operating system. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(current);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if (!document.documentElement.hasAttribute('data-theme')) setTheme(current()); };
    mq.addEventListener('change', onChange); return () => mq.removeEventListener('change', onChange);
  }, []);
  const toggle = useCallback(() => {
    const next: Theme = current() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next); setTheme(next);
    try { localStorage.setItem('ur.theme', next); } catch { /* storage unavailable */ }
  }, []);
  return { theme, toggle };
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme(); const dark = theme === 'dark';
  return <button onClick={toggle} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} title={dark ? 'Light theme' : 'Dark theme'}
    className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface2 hover:text-ink">{dark ? <Sun size={20} /> : <Moon size={20} />}</button>;
}

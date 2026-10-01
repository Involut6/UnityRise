import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Inbox, X } from 'lucide-react';
import { api } from './api';

/* ---- toasts ---- */
type T = { id: number; text: string; ok: boolean };
const Ctx = createContext<{ ok: (m: string) => void; err: (m: string) => void }>({ ok: () => {}, err: () => {} });
export const useToast = () => useContext(Ctx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, set] = useState<T[]>([]);
  const push = (text: string, ok: boolean) => { const id = Date.now() + Math.random(); set(s => [...s, { id, text, ok }]); setTimeout(() => set(s => s.filter(x => x.id !== id)), 4500); };
  return <Ctx.Provider value={{ ok: m => push(m, true), err: m => push(m, false) }}>{children}
    <div className="toasts" role="status">{items.map(t => <div className="toast" key={t.id}>{t.ok ? <CheckCircle2 size={18} color="#4ade80" /> : <AlertCircle size={18} color="#f87171" />}<span>{t.text}</span></div>)}</div></Ctx.Provider>;
}

/** Wraps an async action: toast on success/failure, busy flag for disabling buttons. */
export function useRun(onDone?: () => void) {
  const toast = useToast(); const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn: () => Promise<unknown>, okMsg = 'Done') => {
    setBusy(true);
    try { await fn(); toast.ok(okMsg); onDone?.(); return true; } catch (e: any) { toast.err(e.message ?? 'Something went wrong'); return false; } finally { setBusy(false); }
  }, [onDone, toast]);
  return [run, busy] as const;
}

export function useLoad<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null); const [loading, setLoading] = useState(!!path);
  const reload = useCallback(() => { if (!path) return; api<T>('GET', path).then(setData).catch(() => setData(null)).finally(() => setLoading(false)); }, [path]);
  useEffect(() => { setLoading(true); reload(); }, [reload]);
  return { data, loading, reload };
}

/* ---- building blocks ---- */
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  return <div className="overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
    <div className="modal-h"><h3 className="grow">{title}</h3><button className="x" onClick={onClose} aria-label="Close"><X size={20} /></button></div><div className="modal-b">{children}</div></div></div>;
}
export const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => <div className="field"><label>{label}</label>{children}{hint && <span className="hint">{hint}</span>}</div>;
export const Card = ({ title, action, children, className = '' }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) =>
  <section className={'card ' + className}>{(title || action) && <div className="card-head"><h3 className="grow">{title}</h3>{action}</div>}{children}</section>;
export const Stat = ({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) => <div className="card stat"><div className="ico">{icon}</div><div><small>{label}</small><b>{value}</b></div></div>;
export const Empty = ({ text, icon }: { text: string; icon?: ReactNode }) => <div className="empty">{icon ?? <Inbox size={32} />}<div>{text}</div></div>;
export const Skeleton = ({ h = 20, w = '100%' }: { h?: number; w?: string }) => <div className="skel" style={{ height: h, width: w }} />;
export const Progress = ({ value }: { value: number }) => <div className="progress" role="progressbar" aria-valuenow={Math.round(value)}><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
export const Badge = ({ tone, children }: { tone?: 'green' | 'amber' | 'red' | 'blue' | ''; children: ReactNode }) => <span className={'badge ' + (tone ?? '')}>{children}</span>;
const TONES: Record<string, 'green' | 'amber' | 'red' | 'blue'> = { approved: 'green', active: 'green', completed: 'green', open: 'blue', accepted: 'green', success: 'green', matured: 'green', submitted: 'amber', pending: 'amber', under_review: 'amber', guarantors_pending: 'amber', draft: 'amber', rejected: 'red', declined: 'red', failed: 'red', defaulted: 'red', closed: 'blue' };
export const Status = ({ s }: { s: string }) => <Badge tone={TONES[s] ?? ''}>{s.replace(/_/g, ' ')}</Badge>;
export const Seg = ({ value, onChange, items }: { value: string; onChange: (v: string) => void; items: [string, string][] }) =>
  <div className="seg" role="tablist">{items.map(([k, l]) => <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}</div>;
export const Spinner = () => <div className="grid"><Skeleton h={90} /><Skeleton h={160} /></div>;
export const initials = (s: string) => s.split(/[\s@]/).filter(Boolean).slice(0, 2).map(x => x[0]!.toUpperCase()).join('');
export async function download(path: string, name: string) {
  const r = await fetch('/api' + path, { headers: { authorization: 'Bearer ' + sessionStorage.getItem('t') } });
  const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
export const val = (e: React.FormEvent<HTMLFormElement>) => Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;

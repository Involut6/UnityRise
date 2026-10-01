import { ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Button, cn } from './primitives';
import { Textarea, FormField } from './forms';

/** Shared behaviour: Esc to close, focus moves in, focus returns on close, background scroll locked. */
function useOverlay(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null; const el = ref.current;
    el?.querySelector<HTMLElement>('[data-autofocus],input,select,textarea,button:not([data-close])')?.focus({ preventScroll: true }) ?? el?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab' && el) { const f = [...el.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent !== null);
        if (!f.length) return; const first = f[0]!, last = f[f.length - 1]!; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
    };
    document.addEventListener('keydown', key); const o = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = o; prev?.focus?.(); };
  }, [onClose]);
  return ref;
}

export function Modal({ title, description, onClose, children, footer, size = 'md' }: { title: string; description?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  const ref = useOverlay(onClose);
  return createPortal(
    <div className="fixed inset-0 z-50 flex animate-fade items-end justify-center bg-ink/50 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
        className={cn('flex max-h-[92vh] w-full animate-pop flex-col rounded-t-2xl bg-surface shadow-pop sm:rounded-2xl', size === 'sm' ? 'sm:max-w-md' : size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <header className="flex items-start gap-3 border-b border-line px-5 py-4"><div className="min-w-0 flex-1"><h2 className="text-lg font-semibold">{title}</h2>{description && <p className="text-sm text-muted">{description}</p>}</div>
          <button data-close onClick={onClose} aria-label="Close dialog" className="-mr-1 grid size-9 place-items-center rounded-lg text-muted hover:bg-surface2"><X size={20} /></button></header>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">{footer}</footer>}
      </div></div>, document.body);
}

export function Drawer({ title, subtitle, onClose, children, footer, width = 'max-w-xl' }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: string }) {
  const ref = useOverlay(onClose);
  return createPortal(
    <div className="fixed inset-0 z-50 flex animate-fade justify-end bg-ink/50" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <aside ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Details'} className={cn('flex h-full w-full animate-slide flex-col bg-surface shadow-pop', width)}>
        <header className="flex items-start gap-3 border-b border-line px-5 py-4"><div className="min-w-0 flex-1"><h2 className="truncate text-lg font-semibold">{title}</h2>{subtitle && <div className="text-sm text-muted">{subtitle}</div>}</div>
          <button data-close onClick={onClose} aria-label="Close panel" className="-mr-1 grid size-9 place-items-center rounded-lg text-muted hover:bg-surface2"><X size={20} /></button></header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</footer>}
      </aside></div>, document.body);
}

/* ---- Confirmation dialog (promise-based so sensitive actions read linearly) ---- */
interface ConfirmOpts { title: string; message?: ReactNode; confirmLabel?: string; tone?: 'primary' | 'danger'; requireReason?: boolean; reasonLabel?: string }
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<{ ok: boolean; reason: string }>>(() => Promise.resolve({ ok: false, reason: '' }));
export const useConfirm = () => useContext(ConfirmCtx);
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [st, setSt] = useState<(ConfirmOpts & { resolve: (r: { ok: boolean; reason: string }) => void }) | null>(null); const [reason, setReason] = useState('');
  const ask = useCallback((o: ConfirmOpts) => new Promise<{ ok: boolean; reason: string }>(resolve => { setReason(''); setSt({ ...o, resolve }); }), []);
  const done = (ok: boolean) => { st?.resolve({ ok, reason: reason.trim() }); setSt(null); };
  return <ConfirmCtx.Provider value={ask}>{children}
    {st && <Modal size="sm" title={st.title} onClose={() => done(false)} footer={<>
      <Button variant="outline" onClick={() => done(false)}>Cancel</Button>
      <Button variant={st.tone === 'danger' ? 'danger' : 'primary'} disabled={st.requireReason && !reason.trim()} onClick={() => done(true)} data-autofocus={!st.requireReason || undefined}>{st.confirmLabel ?? 'Confirm'}</Button></>}>
      {st.message && <div className="text-sm text-muted">{st.message}</div>}
      {st.requireReason && <div className="mt-4"><FormField label={st.reasonLabel ?? 'Reason'} required><Textarea value={reason} onChange={e => setReason(e.target.value)} data-autofocus /></FormField></div>}
    </Modal>}</ConfirmCtx.Provider>;
}

/* ---- Toasts ---- */
interface T { id: number; text: string; ok: boolean }
const ToastCtx = createContext<{ success: (m: string) => void; error: (m: string) => void }>({ success: () => {}, error: () => {} });
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, set] = useState<T[]>([]);
  const push = useCallback((text: string, ok: boolean) => { const id = Date.now() + Math.random(); set(s => [...s.slice(-3), { id, text, ok }]); setTimeout(() => set(s => s.filter(x => x.id !== id)), ok ? 4000 : 7000); }, []);
  return <ToastCtx.Provider value={{ success: m => push(m, true), error: m => push(m, false) }}>{children}
    <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-20 z-[70] grid justify-items-center gap-2 md:inset-x-auto md:bottom-6 md:right-6 md:justify-items-end">
      {items.map(t => <div key={t.id} role={t.ok ? 'status' : 'alert'} className="pointer-events-auto flex max-w-sm animate-pop items-start gap-2.5 rounded-xl bg-ink px-4 py-3 text-sm font-medium text-bg shadow-pop">
        {t.ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#4ade80]" /> : <AlertCircle size={18} className="mt-0.5 shrink-0 text-[#f87171]" />}<span>{t.text}</span></div>)}</div></ToastCtx.Provider>;
}

/** Runs an async action with a busy flag and success/error toasts. */
export function useAction(onDone?: () => void) {
  const toast = useToast(); const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn: () => Promise<unknown>, successMsg?: string) => {
    setBusy(true);
    try { await fn(); if (successMsg) toast.success(successMsg); onDone?.(); return true; } catch (e: any) { toast.error(e.message ?? 'Something went wrong'); return false; } finally { setBusy(false); }
  }, [onDone, toast]);
  return [run, busy] as const;
}

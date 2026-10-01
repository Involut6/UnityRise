import { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { CheckCircle2, FileUp, Search, Upload, X } from 'lucide-react';
import { cn } from './primitives';

const base = 'w-full rounded-lg border bg-surface px-3 text-[15px] text-ink placeholder:text-muted/70 transition focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20 disabled:bg-surface2 disabled:text-muted';
const state = (err?: boolean) => (err ? 'border-danger' : 'border-line-strong');

/** FormField publishes the control's id / description / invalid state here, so wrapped inputs are still labelled correctly. */
const FieldCtx = createContext<{ id: string; describedBy?: string; invalid: boolean } | null>(null);
const useField = (p: { id?: string; invalid?: boolean; 'aria-describedby'?: string }) => { const f = useContext(FieldCtx); const invalid = p.invalid ?? f?.invalid; return { id: p.id ?? f?.id, 'aria-describedby': p['aria-describedby'] ?? f?.describedBy, 'aria-invalid': invalid || undefined, invalid }; };

export const Input = ({ invalid: _i, className, ...p }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) => { const f = useField({ ...p, invalid: _i }); return <input className={cn(base, state(f.invalid), 'h-11 md:h-10', className)} {...p} id={f.id} aria-describedby={f['aria-describedby']} aria-invalid={f['aria-invalid']} />; };
export const Select = ({ invalid: _i, className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) => { const f = useField({ ...p, invalid: _i }); return <select className={cn(base, state(f.invalid), 'h-11 md:h-10 pr-8', className)} {...p} id={f.id} aria-describedby={f['aria-describedby']} aria-invalid={f['aria-invalid']}>{children}</select>; };
export const Textarea = ({ invalid: _i, className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) => { const f = useField({ ...p, invalid: _i }); return <textarea className={cn(base, state(f.invalid), 'min-h-24 py-2.5', className)} {...p} id={f.id} aria-describedby={f['aria-describedby']} aria-invalid={f['aria-invalid']} />; };

/** Label + control + hint/error wired together for screen readers. */
export function FormField({ label, hint, error, required, children, className }: { label: string; hint?: string; error?: string; required?: boolean; children: ReactNode; className?: string }) {
  const id = useId(); const describedBy = error ? `${id}-e` : hint ? `${id}-h` : undefined;
  return <FieldCtx.Provider value={{ id, describedBy, invalid: !!error }}><div className={cn('mb-4 grid gap-1.5', className)}>
    <label htmlFor={id} className="text-sm font-medium">{label}{required && <span className="text-danger" aria-hidden> *</span>}</label>{children}
    {error ? <p id={`${id}-e`} role="alert" className="text-xs text-danger">{error}</p> : hint ? <p id={`${id}-h`} className="text-xs text-muted">{hint}</p> : null}</div></FieldCtx.Provider>;
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  const [v, setV] = useState(value); const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => setV(value), [value]);
  return <div className={cn('relative', className)}><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
    <Input type="search" aria-label={placeholder} placeholder={placeholder} value={v} className="pl-9" onChange={e => { setV(e.target.value); clearTimeout(t.current); t.current = setTimeout(() => onChange(e.target.value), 250); }} /></div>;
}
export const DatePicker = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <Input type="date" className={cn('min-w-0', className)} {...p} />;

/** ₦-prefixed numeric input. Emits a number (or NaN when empty). */
export function MoneyInput({ value, onChange, ...p }: { value: number | ''; onChange: (n: number | '') => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-medium text-muted" aria-hidden>₦</span>
    <Input inputMode="decimal" className="pl-8 num" value={value === '' ? '' : String(value)} onChange={e => { const s = e.target.value.replace(/[^\d.]/g, ''); onChange(s === '' ? '' : Number(s)); }} {...p} /></div>;
}

export function OptionCard({ selected, onSelect, title, description, right, name }: { selected: boolean; onSelect: () => void; title: ReactNode; description?: ReactNode; right?: ReactNode; name: string }) {
  return <label className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition focus-within:ring-3 focus-within:ring-brand/20', selected ? 'border-brand bg-brand-soft' : 'border-line-strong bg-surface hover:bg-surface2')}>
    <input type="radio" name={name} checked={selected} onChange={onSelect} className="mt-1 size-4 accent-[var(--c-brand)]" />
    <span className="min-w-0 flex-1"><span className="block font-semibold">{title}</span>{description && <span className="block text-sm text-muted">{description}</span>}</span>{right}</label>;
}

export function FileUpload({ label, file, onChange, accept = 'image/*,.pdf', maxMb = 5, hint }: { label: string; file: File | null; onChange: (f: File | null) => void; accept?: string; maxMb?: number; hint?: string }) {
  const id = useId(); const [err, setErr] = useState('');
  const pick = (f?: File) => { if (!f) return; if (f.size > maxMb * 1024 * 1024) { setErr(`File is larger than ${maxMb}MB`); return; } setErr(''); onChange(f); };
  return <div className="mb-3">
    <div className={cn('flex items-center gap-3 rounded-xl border-2 border-dashed p-3 transition', file ? 'border-success/60 bg-success-soft' : 'border-line-strong bg-surface2 hover:border-brand')}
      onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}>
      <div className={cn('grid size-10 shrink-0 place-items-center rounded-lg', file ? 'text-success' : 'bg-surface text-muted')}>{file ? <CheckCircle2 size={22} /> : <FileUp size={20} />}</div>
      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{label}</p><p className="truncate text-xs text-muted">{file ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB` : hint ?? `PNG, JPG or PDF up to ${maxMb}MB`}</p></div>
      {file ? <button type="button" onClick={() => onChange(null)} className="rounded-md p-2 text-muted hover:bg-surface" aria-label={`Remove ${label}`}><X size={16} /></button>
        : <label htmlFor={id} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-sm font-semibold hover:bg-surface2"><Upload size={15} />Choose</label>}
      <input id={id} type="file" accept={accept} className="sr-only" onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
    </div>{err && <p role="alert" className="mt-1 text-xs text-danger">{err}</p>}</div>;
}

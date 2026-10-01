import { Children, ReactNode, RefObject, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { cn } from './primitives';
import { useField } from './field';

/* ---------------------------------------------------------------- shared popover */
const isMobile = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches;
const triggerCls = (invalid?: boolean, open?: boolean) => cn('flex h-11 w-full items-center gap-2 rounded-lg border bg-surface px-3 text-left text-[15px] text-ink transition focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20 disabled:bg-surface2 disabled:text-muted md:h-10',
  invalid ? 'border-danger' : open ? 'border-brand ring-3 ring-brand/20' : 'border-line-strong hover:border-muted');

/** Floating panel anchored to a trigger (portal, so tables/modals never clip it). Bottom sheet on phones. */
function Popover({ open, anchor, onClose, width, est, label, children, panelRef }: {
  open: boolean; anchor: RefObject<HTMLElement | null>; onClose: () => void; width?: number; est: number; label: string; children: ReactNode; panelRef?: RefObject<HTMLDivElement | null>;
}) {
  const inner = useRef<HTMLDivElement>(null); const ref = panelRef ?? inner; const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight?: number } | null>(null); const [sheet, setSheet] = useState(false);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useLayoutEffect(() => {
    if (!open) return; const mobile = isMobile(); setSheet(mobile);
    const update = () => { const r = anchor.current?.getBoundingClientRect(); if (!r) return; const w = width ?? r.width; const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)); const below = window.innerHeight - r.bottom, above = r.top;
      // Prefer below; otherwise the roomier side. Cap the height to that side so the panel scrolls instead of clipping.
      setPos(below >= est + 12 || below >= above ? { left, width: w, top: r.bottom + 6, maxHeight: Math.max(200, below - 16) } : { left, width: w, bottom: window.innerHeight - r.top + 6, maxHeight: Math.max(200, above - 16) }); };
    update(); window.addEventListener('resize', update); window.addEventListener('scroll', update, true);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [open, anchor, width, est]);
  useEffect(() => {
    if (!open) return;
    // Escape closes only the popover (capture + stopPropagation keeps a parent modal from closing too).
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); closeRef.current(); } };
    const down = (e: MouseEvent) => { const t = e.target as Node; if (!ref.current?.contains(t) && !anchor.current?.contains(t)) closeRef.current(); };
    document.addEventListener('keydown', key, true); document.addEventListener('mousedown', down);
    return () => { document.removeEventListener('keydown', key, true); document.removeEventListener('mousedown', down); };
  }, [open, anchor, ref]);
  if (!open || (!pos && !sheet)) return null;
  return createPortal(<>
    {sheet && <div className="fixed inset-0 z-[60] animate-fade bg-ink/40" onMouseDown={() => onClose()} aria-hidden />}
    <div ref={ref} role="dialog" aria-label={label} onMouseDown={e => e.stopPropagation()}
      style={sheet ? undefined : { left: pos!.left, width: pos!.width, top: pos!.top, bottom: pos!.bottom, maxHeight: pos!.maxHeight }}
      className={cn('z-[61] animate-pop overflow-y-auto overscroll-contain border border-line bg-surface shadow-pop scroll-thin', sheet ? 'fixed inset-x-0 bottom-0 max-h-[88vh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]' : 'fixed rounded-xl')}>
      {sheet && <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line-strong" aria-hidden />}{children}</div></>, document.body);
}

/* ---------------------------------------------------------------- Select */
interface Opt { value: string; label: ReactNode; disabled?: boolean }
export interface SelectProps { value?: string | number; onChange?: (e: { target: { value: string } }) => void; children?: ReactNode; className?: string; disabled?: boolean; placeholder?: string; invalid?: boolean; id?: string; 'aria-label'?: string; 'aria-describedby'?: string }

/** Drop-in replacement for <select>: pass <option> children and an onChange that reads e.target.value. */
export function Select({ value, onChange, children, className, disabled, placeholder = 'Select…', invalid: inv, ...p }: SelectProps) {
  const f = useField({ ...p, invalid: inv }); const listId = useId(); const trigger = useRef<HTMLButtonElement>(null); const list = useRef<HTMLDivElement>(null);
  const opts: Opt[] = Children.toArray(children).filter(isValidElement).map((c: any) => ({ value: String(c.props.value ?? (typeof c.props.children === 'string' ? c.props.children : '')), label: c.props.children, disabled: c.props.disabled }));
  const sel = opts.findIndex(o => o.value === String(value ?? '')); const [open, setOpen] = useState(false); const [active, setActive] = useState(0); const buf = useRef({ s: '', t: 0 });
  const enabled = (i: number, dir: 1 | -1) => { for (let n = i; n >= 0 && n < opts.length; n += dir) if (!opts[n]!.disabled) return n; return -1; };
  const openList = () => { setActive(sel >= 0 ? sel : Math.max(0, enabled(0, 1))); setOpen(true); };
  const close = useCallback(() => { setOpen(false); trigger.current?.focus(); }, []);
  const choose = (i: number) => { const o = opts[i]; if (!o || o.disabled) return; onChange?.({ target: { value: o.value } }); close(); };
  useEffect(() => { if (open) list.current?.querySelector(`[id="${listId}-${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [open, active, listId]);
  const onKey = (e: React.KeyboardEvent) => {
    const move = (dir: 1 | -1, from = active + dir) => { const n = enabled(from, dir); if (n >= 0) setActive(n); };
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); open ? move(1) : openList(); break;
      case 'ArrowUp': e.preventDefault(); open ? move(-1) : openList(); break;
      case 'Home': if (open) { e.preventDefault(); setActive(Math.max(0, enabled(0, 1))); } break;
      case 'End': if (open) { e.preventDefault(); setActive(Math.max(0, enabled(opts.length - 1, -1))); } break;
      case 'Enter': case ' ': if (!open) { e.preventDefault(); openList(); } else if (buf.current.s === '' || e.key === 'Enter') { e.preventDefault(); choose(active); } break;
      case 'Tab': if (open) setOpen(false); break;
      default: if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { // type-ahead
        const now = Date.now(); buf.current.s = now - buf.current.t > 600 ? e.key.toLowerCase() : buf.current.s + e.key.toLowerCase(); buf.current.t = now;
        const txt = (o: Opt) => (typeof o.label === 'string' ? o.label : o.value).toLowerCase(); let n = opts.findIndex((o, i) => i >= (open ? active + 1 : sel + 1) && !o.disabled && txt(o).startsWith(buf.current.s)); if (n < 0) n = opts.findIndex(o => !o.disabled && txt(o).startsWith(buf.current.s));
        if (n >= 0) { open ? setActive(n) : onChange?.({ target: { value: opts[n]!.value } }); } }
    }
  };
  const current = sel >= 0 ? opts[sel] : undefined;
  return <div className={cn('relative', className)}>
    <button ref={trigger} type="button" id={f.id} disabled={disabled} role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} aria-activedescendant={open ? `${listId}-${active}` : undefined}
      aria-label={p['aria-label']} aria-describedby={f['aria-describedby']} aria-invalid={f['aria-invalid']} className={triggerCls(f.invalid, open)} onClick={() => (open ? close() : openList())} onKeyDown={onKey}>
      <span className={cn('min-w-0 flex-1 truncate', !current && 'text-muted')}>{current ? current.label : placeholder}</span><ChevronDown size={16} className={cn('shrink-0 text-muted transition', open && 'rotate-180')} aria-hidden /></button>
    <Popover open={open} anchor={trigger} onClose={close} est={Math.min(288, opts.length * 40 + 8)} label={p['aria-label'] ?? 'Options'} panelRef={list}>
      <ul role="listbox" id={listId} aria-label={p['aria-label']} className="max-h-72 overflow-y-auto p-1 scroll-thin">
        {opts.map((o, i) => <li key={o.value + i} id={`${listId}-${i}`} role="option" aria-selected={i === sel} aria-disabled={o.disabled || undefined} onMouseDown={e => e.preventDefault()} onMouseEnter={() => !o.disabled && setActive(i)} onClick={() => choose(i)}
          className={cn('flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-[15px] sm:min-h-9', i === active && 'bg-surface2', i === sel && 'font-semibold text-brand', o.disabled && 'cursor-not-allowed opacity-45')}>
          <span className="min-w-0 flex-1">{o.label}</span>{i === sel && <Check size={16} aria-hidden />}</li>)}</ul></Popover></div>;
}

/* ---------------------------------------------------------------- date helpers */
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s?: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? ''); return m ? new Date(+m[1]!, +m[2]! - 1, +m[3]!) : null; };
const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString('en-NG', { month: 'long' }));
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const fmtDate = (d: Date) => d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d: Date, n: number) => { const t = new Date(d.getFullYear(), d.getMonth() + n, 1); t.setDate(Math.min(d.getDate(), new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate())); return t; };
const today = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };

/** Calendar with day / month / year views and full keyboard support (arrows, PageUp/PageDown, Home/End). */
function Calendar({ value, min, max, onPick, autoFocus }: { value: Date | null; min?: Date | null; max?: Date | null; onPick: (d: Date) => void; autoFocus?: boolean }) {
  const start = value ?? today(); const clampD = (d: Date) => (min && d < min ? min : max && d > max ? max : d);
  const [view, setView] = useState<'days' | 'months' | 'years'>('days'); const [focus, setFocus] = useState(clampD(start)); const [yearPage, setYearPage] = useState(Math.floor(start.getFullYear() / 12) * 12);
  const grid = useRef<HTMLDivElement>(null); const moved = useRef(!!autoFocus);
  const ok = (d: Date) => (!min || d >= min) && (!max || d <= max);
  const first = new Date(focus.getFullYear(), focus.getMonth(), 1), offset = (first.getDay() + 6) % 7, days = new Date(focus.getFullYear(), focus.getMonth() + 1, 0).getDate(), t = today();
  useEffect(() => { if (moved.current && view === 'days') grid.current?.querySelector<HTMLButtonElement>(`[data-iso="${iso(focus)}"]`)?.focus(); }, [focus, view]);
  const go = (d: Date) => { moved.current = true; setFocus(d); };
  const onKey = (e: React.KeyboardEvent) => {
    const m: Record<string, Date> = { ArrowLeft: addDays(focus, -1), ArrowRight: addDays(focus, 1), ArrowUp: addDays(focus, -7), ArrowDown: addDays(focus, 7), PageUp: addMonths(focus, e.shiftKey ? -12 : -1), PageDown: addMonths(focus, e.shiftKey ? 12 : 1),
      Home: addDays(focus, -((focus.getDay() + 6) % 7)), End: addDays(focus, 6 - ((focus.getDay() + 6) % 7)) };
    if (m[e.key]) { e.preventDefault(); go(m[e.key]!); }
  };
  const label = view === 'days' ? `${MONTHS[focus.getMonth()]} ${focus.getFullYear()}` : view === 'months' ? String(focus.getFullYear()) : `${yearPage} – ${yearPage + 11}`;
  const nav = (dir: 1 | -1) => view === 'days' ? go(addMonths(focus, dir)) : view === 'months' ? setFocus(addMonths(focus, dir * 12)) : setYearPage(p => p + dir * 12);
  const navBtn = 'grid size-9 place-items-center rounded-lg text-muted transition hover:bg-surface2 hover:text-ink';
  return <div className="p-3">
    <div className="mb-2 flex items-center gap-1"><button type="button" className={navBtn} onClick={() => nav(-1)} aria-label={view === 'days' ? 'Previous month' : view === 'months' ? 'Previous year' : 'Previous years'}><ChevronLeft size={18} /></button>
      <button type="button" className="h-9 flex-1 rounded-lg px-2 text-sm font-semibold hover:bg-surface2" aria-live="polite" onClick={() => { setYearPage(Math.floor(focus.getFullYear() / 12) * 12); setView(v => (v === 'days' ? 'months' : v === 'months' ? 'years' : 'days')); }}>{label}</button>
      <button type="button" className={navBtn} onClick={() => nav(1)} aria-label={view === 'days' ? 'Next month' : view === 'months' ? 'Next year' : 'Next years'}><ChevronRight size={18} /></button></div>
    {view === 'days' && <div ref={grid} onKeyDown={onKey}><div className="mb-1 grid grid-cols-7 text-center text-xs font-medium text-muted" aria-hidden>{WEEKDAYS.map(w => <span key={w} className="py-1">{w}</span>)}</div>
      <div role="grid" aria-label={label} className="grid grid-cols-7 gap-y-0.5">{Array.from({ length: offset }).map((_, i) => <span key={'b' + i} />)}
        {Array.from({ length: days }, (_, i) => { const d = new Date(focus.getFullYear(), focus.getMonth(), i + 1), sel = !!value && iso(d) === iso(value), isToday = iso(d) === iso(t), dis = !ok(d);
          return <button key={i} type="button" data-iso={iso(d)} disabled={dis} tabIndex={iso(d) === iso(focus) ? 0 : -1} aria-pressed={sel} aria-current={isToday ? 'date' : undefined} aria-label={d.toLocaleDateString('en-NG', { dateStyle: 'full' })}
            onClick={() => onPick(d)} className={cn('mx-auto grid size-10 place-items-center rounded-full text-sm transition sm:size-9', sel ? 'bg-brand font-semibold text-on-brand' : isToday ? 'font-semibold text-brand ring-1 ring-inset ring-brand' : 'hover:bg-surface2', dis && 'cursor-not-allowed opacity-30 hover:bg-transparent')}>{i + 1}</button>; })}</div></div>}
    {view === 'months' && <div className="grid grid-cols-3 gap-1.5 py-1">{MONTHS.map((m, i) => { const cur = i === focus.getMonth(); return <button key={m} type="button" onClick={() => { setFocus(clampD(new Date(focus.getFullYear(), i, Math.min(focus.getDate(), new Date(focus.getFullYear(), i + 1, 0).getDate())))); setView('days'); }}
      className={cn('h-11 rounded-lg text-sm font-medium transition sm:h-10', cur ? 'bg-brand-soft text-brand' : 'hover:bg-surface2')} aria-pressed={cur}>{m.slice(0, 3)}</button>; })}</div>}
    {view === 'years' && <div className="grid grid-cols-3 gap-1.5 py-1">{Array.from({ length: 12 }, (_, i) => yearPage + i).map(y => { const cur = y === focus.getFullYear(), dis = (!!max && y > max.getFullYear()) || (!!min && y < min.getFullYear());
      return <button key={y} type="button" disabled={dis} onClick={() => { setFocus(clampD(new Date(y, focus.getMonth(), Math.min(focus.getDate(), new Date(y, focus.getMonth() + 1, 0).getDate())))); setView('months'); }}
        className={cn('h-11 rounded-lg text-sm font-medium transition sm:h-10', cur ? 'bg-brand-soft text-brand' : 'hover:bg-surface2', dis && 'cursor-not-allowed opacity-30 hover:bg-transparent')} aria-pressed={cur}>{y}</button>; })}</div>}
  </div>;
}

const pickerBtn = 'h-9 rounded-lg px-3 text-sm font-semibold text-brand transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-40';
interface DateProps { value?: string; onChange?: (e: { target: { value: string } }) => void; min?: string; max?: string; placeholder?: string; className?: string; disabled?: boolean; required?: boolean; invalid?: boolean; id?: string; 'aria-label'?: string; 'aria-describedby'?: string }

/** Custom date picker. Value is 'YYYY-MM-DD' (same as <input type="date">). */
export function DatePicker({ value, onChange, min, max, placeholder = 'Select date', className, disabled, required, invalid: inv, ...p }: DateProps) {
  const f = useField({ ...p, invalid: inv }); const trigger = useRef<HTMLButtonElement>(null); const [open, setOpen] = useState(false); const d = parse(value); const lo = parse(min), hi = parse(max);
  const close = useCallback(() => { setOpen(false); trigger.current?.focus(); }, []); const pick = (x: Date) => { onChange?.({ target: { value: iso(x) } }); close(); };
  return <div className={cn('relative min-w-0', className)}>
    <button ref={trigger} type="button" id={f.id} disabled={disabled} aria-haspopup="dialog" aria-expanded={open} aria-label={p['aria-label'] && d ? `${p['aria-label']}, ${fmtDate(d)}` : p['aria-label']} aria-describedby={f['aria-describedby']} aria-invalid={f['aria-invalid']} className={triggerCls(f.invalid, open)} onClick={() => setOpen(o => !o)}>
      <span className={cn('min-w-0 flex-1 truncate', !d && 'text-muted')}>{d ? fmtDate(d) : placeholder}</span><CalendarDays size={16} className="shrink-0 text-muted" aria-hidden /></button>
    <Popover open={open} anchor={trigger} onClose={close} width={304} est={400} label={p['aria-label'] ?? 'Choose date'}>
      <Calendar value={d} min={lo} max={hi} onPick={pick} autoFocus />
      <div className="flex items-center justify-between border-t border-line px-2 py-1.5"><button type="button" className={pickerBtn} disabled={(!!lo && today() < lo) || (!!hi && today() > hi)} onClick={() => pick(today())}>Today</button>
        {!required && d && <button type="button" className={cn(pickerBtn, 'text-muted hover:bg-surface2 hover:text-ink')} onClick={() => { onChange?.({ target: { value: '' } }); close(); }}>Clear</button>}</div></Popover></div>;
}

/* ---------------------------------------------------------------- date + time */
function TimeField({ label, value, max, step, onChange }: { label: string; value: number; max: number; step: number; onChange: (n: number) => void }) {
  const [txt, setTxt] = useState(pad(value)); useEffect(() => setTxt(pad(value)), [value]);
  const bump = (n: number) => onChange((value + n + max + 1) % (max + 1)); const btn = 'grid h-7 w-full place-items-center rounded-md text-muted hover:bg-surface2 hover:text-ink';
  return <div className="flex w-14 flex-col items-center"><button type="button" className={btn} onClick={() => bump(step)} aria-label={`Increase ${label}`}><ChevronUp size={16} /></button>
    <input aria-label={label} inputMode="numeric" maxLength={2} value={txt} onFocus={e => e.target.select()} onChange={e => { const s = e.target.value.replace(/\D/g, '').slice(0, 2); setTxt(s); const n = Number(s); if (s !== '' && n <= max) onChange(n); }} onBlur={() => setTxt(pad(value))}
      onKeyDown={e => { if (e.key === 'ArrowUp') { e.preventDefault(); bump(1); } if (e.key === 'ArrowDown') { e.preventDefault(); bump(-1); } }} className="num h-10 w-full rounded-lg border border-line-strong bg-surface text-center text-lg font-semibold focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20" />
    <button type="button" className={btn} onClick={() => bump(-step)} aria-label={`Decrease ${label}`}><ChevronDown size={16} /></button></div>;
}

/** Custom date + time picker. Value is 'YYYY-MM-DDTHH:mm' (same as <input type="datetime-local">). `min` is a date. */
export function DateTimePicker({ value, onChange, min, max, placeholder = 'Select date and time', className, disabled, invalid: inv, ...p }: Omit<DateProps, 'required'>) {
  const f = useField({ ...p, invalid: inv }); const trigger = useRef<HTMLButtonElement>(null); const [open, setOpen] = useState(false); const d = parse(value); const time = /T(\d{2}):(\d{2})/.exec(value ?? ''); const hh = time ? +time[1]! : 9, mm = time ? +time[2]! : 0;
  const emit = (date: Date, h: number, m: number) => onChange?.({ target: { value: `${iso(date)}T${pad(h)}:${pad(m)}` } }); const close = useCallback(() => { setOpen(false); trigger.current?.focus(); }, []);
  return <div className={cn('relative min-w-0', className)}>
    <button ref={trigger} type="button" id={f.id} disabled={disabled} aria-haspopup="dialog" aria-expanded={open} aria-label={p['aria-label']} aria-describedby={f['aria-describedby']} aria-invalid={f['aria-invalid']} className={triggerCls(f.invalid, open)} onClick={() => setOpen(o => !o)}>
      <span className={cn('min-w-0 flex-1 truncate', !d && 'text-muted')}>{d ? `${fmtDate(d)}, ${pad(hh)}:${pad(mm)}` : placeholder}</span><CalendarDays size={16} className="shrink-0 text-muted" aria-hidden /></button>
    <Popover open={open} anchor={trigger} onClose={close} width={304} est={500} label={p['aria-label'] ?? 'Choose date and time'}>
      <Calendar value={d} min={parse(min)} max={parse(max)} onPick={x => emit(x, hh, mm)} autoFocus />
      <div className="flex items-center justify-center gap-2 border-t border-line px-3 py-2"><span className="mr-2 text-sm font-medium text-muted">Time</span><TimeField label="Hour" value={hh} max={23} step={1} onChange={h => emit(d ?? today(), h, mm)} /><span className="text-xl font-semibold" aria-hidden>:</span><TimeField label="Minute" value={mm} max={59} step={5} onChange={m => emit(d ?? today(), hh, m)} /></div>
      <div className="flex justify-end border-t border-line px-2 py-1.5"><button type="button" className={pickerBtn} onClick={close} disabled={!d}>Done</button></div></Popover></div>;
}

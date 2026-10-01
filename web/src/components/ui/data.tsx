import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronRight as Crumb, ArrowDown, ArrowUp } from 'lucide-react';
import { Button, Card, EmptyState, Skeleton, cn } from './primitives';

export interface Column<T> { key: string; header: string; cell: (r: T) => ReactNode; sortBy?: (r: T) => string | number; align?: 'right'; hideOnMobile?: boolean; mobileTitle?: boolean; xlOnly?: boolean; className?: string }

/** Table on ≥md; stacked cards on mobile. Client-side sort + pagination. */
export function DataTable<T>({ columns, rows, rowKey, onRowClick, pageSize = 10, loading, empty, caption }: {
  columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; onRowClick?: (r: T) => void; pageSize?: number; loading?: boolean; empty?: ReactNode; caption?: string;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null); const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [rows.length]);
  const sorted = useMemo(() => { const c = columns.find(x => x.key === sort?.key); if (!c?.sortBy || !sort) return rows; return [...rows].sort((a, b) => (c.sortBy!(a) > c.sortBy!(b) ? 1 : -1) * sort.dir); }, [rows, sort, columns]);
  const total = sorted.length, pages = Math.max(1, Math.ceil(total / pageSize)), cur = Math.min(page, pages), slice = sorted.slice((cur - 1) * pageSize, cur * pageSize);
  if (loading) return <div className="grid gap-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;
  if (!rows.length) return <>{empty ?? <EmptyState title="Nothing to show" description="No records match your filters." />}</>;
  const titleCol = columns.find(c => c.mobileTitle) ?? columns[0]!;
  return <div>
    <div className="hidden overflow-x-auto md:block"><table className="w-full text-sm">{caption && <caption className="sr-only">{caption}</caption>}
      <thead><tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-muted">
        {columns.map(c => <th key={c.key} scope="col" className={cn('px-4 py-3 whitespace-nowrap', c.align === 'right' && 'text-right', c.xlOnly && 'hidden xl:table-cell')} aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
          {c.sortBy ? <button className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide hover:text-ink" onClick={() => setSort(s => (s?.key === c.key ? (s.dir === 1 ? { key: c.key, dir: -1 } : null) : { key: c.key, dir: 1 }))}>
            {c.header}{sort?.key === c.key && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</button> : c.header}</th>)}</tr></thead>
      <tbody>{slice.map(r => <tr key={rowKey(r)} className={cn('border-b border-line last:border-0', onRowClick && 'cursor-pointer hover:bg-surface2')} onClick={() => onRowClick?.(r)}
        tabIndex={onRowClick ? 0 : undefined} onKeyDown={e => { if (onRowClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onRowClick(r); } }}>
        {columns.map(c => <td key={c.key} className={cn('px-4 py-3 align-middle', c.align === 'right' && 'text-right', c.xlOnly && 'hidden xl:table-cell', c.className)}>{c.cell(r)}</td>)}</tr>)}</tbody></table></div>
    <ul className="divide-y divide-line md:hidden">{slice.map(r => <li key={rowKey(r)} className={cn('p-4', onRowClick && 'active:bg-surface2')} onClick={() => onRowClick?.(r)}>
      <div className="mb-2 font-semibold">{titleCol.cell(r)}</div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">{columns.filter(c => c !== titleCol && !c.hideOnMobile).map(c => <div key={c.key} className="min-w-0"><dt className="text-xs text-muted">{c.header}</dt><dd className="truncate">{c.cell(r)}</dd></div>)}</dl></li>)}</ul>
    {total > pageSize && <Pagination page={cur} pages={pages} total={total} pageSize={pageSize} onChange={setPage} />}
  </div>;
}

export function Pagination({ page, pages, total, pageSize, onChange }: { page: number; pages: number; total: number; pageSize: number; onChange: (p: number) => void }) {
  const from = (page - 1) * pageSize + 1, to = Math.min(total, page * pageSize);
  return <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm">
    <p className="text-muted"><span className="hidden sm:inline">Showing </span><span className="num font-medium text-ink">{from}–{to}</span> of <span className="num font-medium text-ink">{total}</span></p>
    <div className="flex items-center gap-1.5"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page" icon={<ChevronLeft size={16} />} />
      <span className="px-2 text-muted num">Page {page} / {pages}</span>
      <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page" icon={<ChevronRight size={16} />} /></div></nav>;
}

/* ---- Tabs (optionally synced to ?tab= so they are linkable) ---- */
export function Tabs({ tabs, value, onChange, className }: { tabs: { key: string; label: string; count?: number }[]; value: string; onChange: (k: string) => void; className?: string }) {
  return <div role="tablist" className={cn('scroll-thin -mx-1 flex gap-1 overflow-x-auto border-b border-line px-1', className)}>
    {tabs.map(t => <button key={t.key} role="tab" id={`tab-${t.key}`} aria-selected={value === t.key} aria-controls={`panel-${t.key}`} onClick={() => onChange(t.key)}
      className={cn('-mb-px inline-flex h-11 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition', value === t.key ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink')}>
      {t.label}{t.count !== undefined && <span className="rounded-full bg-surface2 px-1.5 text-xs text-muted num">{t.count}</span>}</button>)}</div>;
}
export const TabPanel = ({ id, active, children }: { id: string; active: boolean; children: ReactNode }) => active ? <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} className="pt-5">{children}</div> : null;
export function useTabParam(defaultKey: string, keys: string[]) {
  const [sp, setSp] = useSearchParams(); const v = sp.get('tab'); const cur = v && keys.includes(v) ? v : defaultKey;
  return [cur, (k: string) => setSp(p => { const n = new URLSearchParams(p); n.set('tab', k); return n; }, { replace: true })] as const;
}

export const Breadcrumbs = ({ items }: { items: { label: string; to?: string }[] }) => (
  <nav aria-label="Breadcrumb" className="mb-2"><ol className="flex flex-wrap items-center gap-1 text-sm text-muted">{items.map((c, i) => <li key={i} className="flex items-center gap-1">
    {i > 0 && <Crumb size={14} aria-hidden />}{c.to && i < items.length - 1 ? <Link to={c.to} className="hover:text-ink hover:underline">{c.label}</Link> : <span aria-current={i === items.length - 1 ? 'page' : undefined} className={i === items.length - 1 ? 'font-medium text-ink' : ''}>{c.label}</span>}</li>)}</ol></nav>
);

export const FilterBar = ({ children, actions }: { children: ReactNode; actions?: ReactNode }) => (
  <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:flex-wrap sm:items-center"><div className="grid flex-1 gap-3 sm:flex sm:flex-wrap sm:items-center">{children}</div>{actions && <div className="flex gap-2">{actions}</div>}</div>
);
export const TableCard = ({ children }: { children: ReactNode }) => <Card padded={false} className="overflow-hidden">{children}</Card>;

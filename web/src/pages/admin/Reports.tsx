import { useState } from 'react';
import { BarChart3, Download, Printer } from 'lucide-react';
import { Alert, Button, Card, EmptyState, ErrorState, Skeleton } from '../../components/ui/primitives';
import { PageHeader } from '../../components/ui/dashboard';
import { DataTable } from '../../components/ui/data';
import { DatePicker, FormField } from '../../components/ui/forms';
import { saveFile, useApi } from '../../lib/api';
import { date, dateTime, naira, titleCase } from '../../lib/format';

const REPORTS: { group: string; items: [string, string, string][] }[] = [
  { group: 'Financial', items: [['cash-flow', 'Cash flow', 'Monthly money in and out'], ['transactions', 'Transaction ledger', 'Every ledger entry in a period']] },
  { group: 'Savings', items: [['member-savings', 'Member savings', 'Balance per member']] },
  { group: 'Loans', items: [['loan-book', 'Loan book', 'Outstanding balance and arrears per loan']] },
  { group: 'Investments', items: [['investments', 'Investment performance', 'Raised and paid out per scheme']] },
  { group: 'Members', items: [['members', 'Member register', 'All members with KYC status']] },
  { group: 'Regulatory', items: [['regulatory', 'Contributions register (CAC)', 'Member contributions and balances for regulators']] },
];
const MONEY = /amount|balance|outstanding|arrears|principal|raised|paid_out|inflow|outflow|contributions|credit|debit|target/;
const fmt = (k: string, v: any) => v == null || v === '' ? '—' : MONEY.test(k) && !isNaN(Number(v)) ? naira(v) : /(_at|joined|created)$/.test(k) && !isNaN(+new Date(v)) ? (k.endsWith('_at') ? dateTime(v) : date(v)) : k === 'direction' ? (v === 1 ? 'Credit' : 'Debit') : String(v);

export default function Reports() {
  const [kind, setKind] = useState('cash-flow'); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [go, setGo] = useState(0);
  const qs = `${from ? `from=${from}` : ''}${from && to ? '&' : ''}${to ? `to=${to}` : ''}`; const path = `/reports/${kind}`; const r = useApi<any[]>(`${path}?${qs}${go ? '' : ''}`);
  const cols = Object.keys(r.data?.[0] ?? {}); const title = REPORTS.flatMap(g => g.items).find(i => i[0] === kind)?.[1];
  return <>
    <PageHeader title="Reports" description="Preview, filter and export financial and regulatory reports." actions={<><Button variant="outline" icon={<Download size={16} />} disabled={!r.data?.length} onClick={() => saveFile(`${path}?format=csv${qs ? '&' + qs : ''}`, `${kind}.csv`)}>Export Excel</Button><Button variant="outline" icon={<Printer size={16} />} disabled={!r.data?.length} onClick={() => window.print()}>Export PDF</Button></>} />
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <nav aria-label="Report categories" className="no-print grid content-start gap-4">{REPORTS.map(g => <div key={g.group}><p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-muted">{g.group}</p><ul className="grid gap-1">{g.items.map(([k, l, d]) => <li key={k}><button onClick={() => setKind(k)} aria-current={kind === k} className={`w-full rounded-xl border p-3 text-left transition ${kind === k ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:bg-surface2'}`}><p className={`font-semibold ${kind === k ? 'text-brand' : ''}`}>{l}</p><p className="text-xs text-muted">{d}</p></button></li>)}</ul></div>)}</nav>
      <div className="min-w-0 grid content-start gap-4"><Card className="no-print"><div className="grid gap-x-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><FormField label="From date"><DatePicker value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} /></FormField><FormField label="To date"><DatePicker value={to} min={from || undefined} onChange={e => setTo(e.target.value)} /></FormField>
        {(from || to) && <Button className="mb-4" variant="ghost" onClick={() => { setFrom(''); setTo(''); setGo(g => g + 1); }}>Clear</Button>}</div><p className="text-xs text-muted">Dates apply to the transaction ledger, member register and contributions register. Cash flow, savings, loan book and investment reports are always as of today.</p></Card>
        <Card padded={false} className="print-area overflow-hidden"><div className="flex items-center justify-between border-b border-line p-5"><div><h2 className="text-base font-semibold">{title}</h2><p className="text-sm text-muted">{r.data ? `${r.data.length} row${r.data.length === 1 ? '' : 's'}` : ''}{from || to ? ` · ${from ? date(from) : 'start'} to ${to ? date(to) : 'today'}` : ''}</p></div></div>
          {r.loading ? <div className="p-5"><Skeleton className="h-48" /></div> : r.error ? <ErrorState message={r.error.message} onRetry={r.reload} /> : !r.data?.length ? <EmptyState icon={<BarChart3 size={22} />} title="No data for this report" description="Try a wider date range." /> :
            <DataTable rows={r.data.map((x, i) => ({ ...x, _k: String(i) }))} rowKey={x => x._k} pageSize={15} caption={title} columns={cols.map((c, i) => ({ key: c, header: titleCase(c), mobileTitle: i === 0, align: MONEY.test(c) ? 'right' as const : undefined, cell: (x: any) => <span className={MONEY.test(c) ? 'num' : ''}>{fmt(c, x[c])}</span> }))} />}</Card>
        <Alert tone="info">“Export Excel” downloads a .csv file that opens directly in Excel. “Export PDF” opens your browser’s print dialog; choose “Save as PDF”.</Alert></div></div></>;
}

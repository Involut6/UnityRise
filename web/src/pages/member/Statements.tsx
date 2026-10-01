import { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { Button, Card, EmptyState, ErrorState, Skeleton } from '../../components/ui/primitives';
import { PageHeader, StatCard } from '../../components/ui/dashboard';
import { DataTable } from '../../components/ui/data';
import { DatePicker, FormField } from '../../components/ui/forms';
import { saveFile, useApi } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { date, naira, titleCase, toISODate, TXN_LABEL } from '../../lib/format';
import { ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-react';

export default function Statements() {
  const { me } = useAuth(); const now = new Date();
  const [from, setFrom] = useState(toISODate(new Date(now.getFullYear(), now.getMonth(), 1))); const [to, setTo] = useState(toISODate(now));
  const q = `/statement?from=${from}&to=${to}`; const st = useApi<any[]>(from && to && from <= to ? q : null);
  const presets: [string, () => void][] = [['This month', () => { setFrom(toISODate(new Date(now.getFullYear(), now.getMonth(), 1))); setTo(toISODate(now)); }], ['Last 3 months', () => { setFrom(toISODate(new Date(now.getFullYear(), now.getMonth() - 2, 1))); setTo(toISODate(now)); }], ['This year', () => { setFrom(`${now.getFullYear()}-01-01`); setTo(toISODate(now)); }]];
  const sum = useMemo(() => { const r = st.data ?? []; const cr = r.reduce((a, x) => a + Number(x.credit ?? 0), 0), db = r.reduce((a, x) => a + Number(x.debit ?? 0), 0); return { cr, db, net: cr - db }; }, [st.data]);
  return <>
    <PageHeader title="Statements" description="Generate a statement of your savings account for any period." actions={<><Button variant="outline" icon={<Download size={16} />} disabled={!st.data?.length} onClick={() => saveFile(q + '&format=csv', `statement-${from}-to-${to}.csv`)}>Download Excel</Button><Button variant="outline" icon={<Printer size={16} />} disabled={!st.data?.length} onClick={() => window.print()}>Print / Save PDF</Button></>} />
    <Card className="no-print mb-5"><div className="grid gap-x-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><FormField label="From"><DatePicker value={from} max={to} onChange={e => setFrom(e.target.value)} /></FormField><FormField label="To"><DatePicker value={to} min={from} onChange={e => setTo(e.target.value)} /></FormField>
      <div className="mb-4 flex flex-wrap gap-2">{presets.map(([l, fn]) => <Button key={l} size="sm" variant="outline" onClick={fn}>{l}</Button>)}</div></div></Card>
    <div className="print-area">
      <div className="mb-4 hidden print:block"><h1 className="text-xl font-bold">UnityRise savings statement</h1><p>{me?.first_name} {me?.last_name} · {me?.membership_id} · {date(from)} to {date(to)}</p></div>
      <div className="mb-5 grid gap-4 sm:grid-cols-3"><StatCard icon={<ArrowDownLeft size={20} />} tone="success" label="Total credits" value={naira(sum.cr)} /><StatCard icon={<ArrowUpRight size={20} />} tone="warning" label="Total debits" value={naira(sum.db)} /><StatCard icon={<Scale size={20} />} label="Net movement" value={naira(sum.net)} /></div>
      <Card padded={false} className="overflow-hidden">{st.loading ? <div className="p-5"><Skeleton className="h-40" /></div> : st.error ? <ErrorState message={st.error.message} onRetry={st.reload} /> :
        <DataTable rows={(st.data ?? []).map((r, i) => ({ ...r, _k: String(i) }))} rowKey={r => r._k} pageSize={20} caption="Statement"
          empty={<EmptyState title="No activity in this period" description="Try a wider date range." />}
          columns={[{ key: 'd', header: 'Date', cell: r => date(r.created_at), mobileTitle: true }, { key: 't', header: 'Type', cell: r => TXN_LABEL[r.type] ?? titleCase(r.type) }, { key: 'n', header: 'Description', cell: r => r.narration ?? '—', hideOnMobile: true },
            { key: 'c', header: 'Credit', align: 'right', cell: r => r.credit ? <span className="num font-semibold text-success">{naira(r.credit)}</span> : '—' }, { key: 'x', header: 'Debit', align: 'right', cell: r => r.debit ? <span className="num font-semibold">{naira(r.debit)}</span> : '—' }]} />}</Card></div>
  </>;
}

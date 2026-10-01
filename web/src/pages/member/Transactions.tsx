import { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { Button, ErrorState } from '../../components/ui/primitives';
import { PageHeader, TransactionTable, type TxnRow } from '../../components/ui/dashboard';
import { DatePicker, Select, SearchInput } from '../../components/ui/forms';
import { FilterBar, TableCard } from '../../components/ui/data';
import { Drawer } from '../../components/ui/overlay';
import { StatusBadge } from '../../components/ui/primitives';
import { useMemberTxns } from '../../lib/data';
import { TXN_LABEL, dateTime, downloadText, naira, toCsv } from '../../lib/format';

export default function Transactions() {
  const tx = useMemberTxns(); const [q, setQ] = useState(''); const [type, setType] = useState(''); const [status, setStatus] = useState(''); const [dir, setDir] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [sel, setSel] = useState<TxnRow | null>(null);
  const rows = useMemo(() => tx.rows.filter(r => (!type || r.type === type) && (!status || (r.status ?? 'success') === status) && (!dir || String(r.direction) === dir) && (!from || r.created_at.slice(0, 10) >= from) && (!to || r.created_at.slice(0, 10) <= to)
    && (!q || `${r.narration ?? ''} ${r.reference ?? ''} ${TXN_LABEL[r.type] ?? ''}`.toLowerCase().includes(q.toLowerCase()))), [tx.rows, q, type, status, dir, from, to]);
  const exportCsv = () => downloadText('transactions.csv', toCsv(rows.map(r => ({ Date: dateTime(r.created_at), Type: TXN_LABEL[r.type] ?? r.type, Direction: r.direction === 1 ? 'Credit' : 'Debit', Description: r.narration ?? '', Amount: r.amount, Status: r.status ?? 'success', Reference: r.reference ?? '' }))));
  if (tx.error) return <ErrorState message={tx.error.message} onRetry={tx.reload} />;
  const dirty = q || type || status || dir || from || to;
  return <>
    <PageHeader title="Transactions" description="Every credit, debit and payment on your account." actions={<><Button variant="outline" icon={<Download size={16} />} onClick={exportCsv} disabled={!rows.length}>Export Excel</Button><Button variant="outline" icon={<Printer size={16} />} onClick={() => window.print()}>Export PDF</Button></>} />
    <TableCard><FilterBar actions={dirty ? <Button size="sm" variant="ghost" onClick={() => { setQ(''); setType(''); setStatus(''); setDir(''); setFrom(''); setTo(''); }}>Clear</Button> : undefined}>
      <SearchInput className="sm:w-64" value={q} onChange={setQ} placeholder="Search description or reference" />
      <div className="sm:w-44"><Select aria-label="Type" value={type} onChange={e => setType(e.target.value)}><option value="">All types</option>{Object.entries(TXN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
      <div className="sm:w-36"><Select aria-label="Credit or debit" value={dir} onChange={e => setDir(e.target.value)}><option value="">Credit & debit</option><option value="1">Credit</option><option value="-1">Debit</option></Select></div>
      <div className="sm:w-36"><Select aria-label="Status" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option><option value="success">Successful</option><option value="pending">Pending</option><option value="failed">Failed</option></Select></div>
      <div className="grid gap-3 min-[460px]:grid-cols-2 sm:flex"><DatePicker aria-label="From date" value={from} onChange={e => setFrom(e.target.value)} /><DatePicker aria-label="To date" value={to} onChange={e => setTo(e.target.value)} /></div></FilterBar>
      <div className="print-area"><TransactionTable rows={rows} loading={tx.loading} pageSize={15} onRowClick={setSel} /></div></TableCard>
    {sel && <Drawer title="Transaction details" subtitle={sel.reference ?? undefined} onClose={() => setSel(null)} width="max-w-md"><p className="num text-3xl font-bold">{sel.direction === 1 ? '+' : '−'}{naira(sel.amount)}</p><div className="mt-2"><StatusBadge status={sel.status ?? 'success'} /></div>
      <dl className="mt-6 divide-y divide-line rounded-xl border border-line text-sm">{[['Description', sel.narration || TXN_LABEL[sel.type]], ['Type', `${sel.direction === 1 ? 'Credit' : 'Debit'} · ${TXN_LABEL[sel.type] ?? sel.type}`], ['Date', dateTime(sel.created_at)], ['Reference', <span className="break-all font-mono text-xs">{sel.reference ?? '—'}</span>]].map(([k, v], i) =>
        <div key={i} className="flex justify-between gap-4 px-4 py-3"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}</dl></Drawer>}
  </>;
}

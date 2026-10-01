import { useState } from 'react';
import { FileText } from 'lucide-react';
import { EmptyState, ErrorState } from '../../components/ui/primitives';
import { PageHeader } from '../../components/ui/dashboard';
import { DataTable, FilterBar, TableCard } from '../../components/ui/data';
import { SearchInput, Select } from '../../components/ui/forms';
import { DocViewer } from '../../components/features/DocViewer';
import { useApi } from '../../lib/api';
import { date } from '../../lib/format';
import { Link } from 'react-router-dom';

const KIND: Record<string, string> = { photo: 'Passport photograph', id_card: 'Government ID', signature: 'Signature', proof_of_address: 'Proof of address' };
export default function Documents() {
  const d = useApi<any[]>('/admin/documents'); const [q, setQ] = useState(''); const [kind, setKind] = useState('');
  const rows = (d.data ?? []).filter(x => (!kind || x.kind === kind) && (!q || `${x.member} ${x.membership_id ?? ''} ${x.filename}`.toLowerCase().includes(q.toLowerCase())));
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  return <><PageHeader title="Documents" description="Identity documents uploaded by members." />
    <TableCard><FilterBar><SearchInput className="sm:w-72" value={q} onChange={setQ} placeholder="Search member or file" /><div className="sm:w-52"><Select aria-label="Document type" value={kind} onChange={e => setKind(e.target.value)}><option value="">All document types</option>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div></FilterBar>
      <DataTable rows={rows} rowKey={x => x.id} loading={d.loading} pageSize={12} caption="Documents" empty={<EmptyState icon={<FileText size={22} />} title="No documents" />}
        columns={[{ key: 't', header: 'Document', mobileTitle: true, cell: x => <div><p className="font-medium">{KIND[x.kind]}</p><p className="max-w-56 truncate text-xs text-muted">{x.filename}</p></div> }, { key: 'm', header: 'Member', cell: x => <Link className="text-brand hover:underline" to={`/admin/members/${x.member_id}`}>{x.member}</Link> }, { key: 'i', header: 'ID', cell: x => x.membership_id ?? '—', hideOnMobile: true },
          { key: 'd', header: 'Uploaded', sortBy: x => x.created_at, cell: x => date(x.created_at) }, { key: 'v', header: '', align: 'right', cell: x => <DocViewer path={`/members/${x.member_id}/documents/${x.id}/file`} name={x.filename} label={KIND[x.kind]} /> }]} /></TableCard></>;
}

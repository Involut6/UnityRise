import { useState } from 'react';
import { Alert, Badge, Card, CardHeader, ErrorState } from '../../components/ui/primitives';
import { PageHeader } from '../../components/ui/dashboard';
import { DataTable, FilterBar, TableCard } from '../../components/ui/data';
import { SearchInput, Select } from '../../components/ui/forms';
import { useAction, useConfirm } from '../../components/ui/overlay';
import { api, invalidate, useApi } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { date, titleCase } from '../../lib/format';

const ROLES = ['member', 'loan_manager', 'accountant', 'admin'];
const MATRIX: [string, string][] = [['Member', 'Own wallet, loans, investments and votes'], ['Loan manager', 'Give final approval or rejection on loan applications (with the super admin)'], ['Accountant', 'Disburse loans, view payments, transactions, reports; declare investment maturity'], ['Admin', 'KYC approval, schemes, communication, governance, audit logs, settings. Cannot approve loans'], ['Super admin', 'Everything, including assigning roles']];
export default function Users() {
  const { me } = useAuth(); const [q, setQ] = useState(''); const u = useApi<any[]>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`); const confirm = useConfirm(); const [run] = useAction(() => invalidate('/admin/users'));
  const setRole = async (x: any, role: string) => { const c = await confirm({ title: 'Change role?', message: <>Change <b className="text-ink">{x.email}</b> from {titleCase(x.role)} to <b className="text-ink">{titleCase(role)}</b>? Their access changes immediately.</>, confirmLabel: 'Change role' }); if (c.ok) run(() => api('PUT', `/admin/users/${x.id}/role`, { role }), 'Role updated'); };
  const toggle = async (x: any) => { const c = await confirm({ title: x.is_active ? 'Disable account?' : 'Re-enable account?', tone: x.is_active ? 'danger' : 'primary', confirmLabel: x.is_active ? 'Disable' : 'Enable', message: x.is_active ? `${x.email} will be signed out and unable to sign in.` : `${x.email} will be able to sign in again.` }); if (c.ok) run(() => api('PUT', `/admin/users/${x.id}/active`, { active: !x.is_active }), x.is_active ? 'Account disabled' : 'Account enabled'); };
  if (u.error) return <ErrorState message={u.error.message} onRetry={u.reload} />;
  return <><PageHeader title="Users & roles" description="Control who can do what." />
    <div className="grid gap-5 xl:grid-cols-[1fr_340px]"><TableCard><FilterBar><SearchInput className="sm:w-72" value={q} onChange={setQ} placeholder="Search by email" /></FilterBar>
      <DataTable rows={u.data ?? []} rowKey={x => x.id} loading={u.loading} pageSize={12} caption="Users" columns={[{ key: 'e', header: 'User', mobileTitle: true, cell: x => <span className="font-medium">{x.email}</span> },
        { key: 'r', header: 'Role', cell: x => x.role === 'super_admin' || x.id === me?.id ? <Badge tone="brand">{titleCase(x.role)}</Badge> : <Select aria-label={`Role for ${x.email}`} className="min-w-36" value={x.role} onChange={e => setRole(x, e.target.value)}>{ROLES.map(r => <option key={r} value={r}>{titleCase(r)}</option>)}</Select> },
        { key: 's', header: 'Status', cell: x => (x.role === 'super_admin' || x.id === me?.id ? <Badge tone="success">Active</Badge> : <button onClick={() => toggle(x)} className="rounded-full focus-visible:outline-offset-4" aria-label={`${x.is_active ? 'Disable' : 'Enable'} ${x.email}`}><Badge tone={x.is_active ? 'success' : 'danger'}>{x.is_active ? 'Active · click to disable' : 'Disabled · click to enable'}</Badge></button>) }, { key: 'c', header: 'Created', cell: x => date(x.created_at), hideOnMobile: true }]} /></TableCard>
      <Card className="h-fit"><CardHeader title="What each role can do" /><dl className="grid gap-3 text-sm">{MATRIX.map(([k, v]) => <div key={k}><dt className="font-semibold">{k}</dt><dd className="text-muted">{v}</dd></div>)}</dl><div className="mt-4"><Alert tone="info">You cannot change your own role or the super admin's.</Alert></div></Card></div></>;
}

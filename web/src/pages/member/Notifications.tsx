import { useState } from 'react';
import { Bell, CheckCheck, Megaphone } from 'lucide-react';
import { Button, Card, EmptyState, ErrorState, Badge, Skeleton } from '../../components/ui/primitives';
import { PageHeader } from '../../components/ui/dashboard';
import { Tabs, TabPanel, useTabParam } from '../../components/ui/data';
import { useAction } from '../../components/ui/overlay';
import { api, invalidate, useApi } from '../../lib/api';
import { dateTime } from '../../lib/format';

export default function Notifications() {
  const n = useApi<any[]>('/notifications'); const a = useApi<any[]>('/announcements'); const [tab, setTab] = useTabParam('inbox', ['inbox', 'announcements']); const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [run, busy] = useAction(() => invalidate('/notifications'));
  const unread = n.data?.filter(x => !x.read_at) ?? []; const list = (filter === 'unread' ? unread : n.data) ?? [];
  return <>
    <PageHeader title="Notifications" description="Messages and announcements from your cooperative." actions={<Button variant="outline" icon={<CheckCheck size={16} />} disabled={!unread.length} loading={busy} onClick={() => run(async () => { for (const x of unread) await api('POST', `/notifications/${x.id}/read`); }, 'All marked as read')}>Mark all as read</Button>} />
    <Tabs value={tab} onChange={setTab} tabs={[{ key: 'inbox', label: 'Inbox', count: unread.length }, { key: 'announcements', label: 'Announcements' }]} />
    <TabPanel id="inbox" active={tab === 'inbox'}>
      <div className="mb-4 flex gap-2">{(['all', 'unread'] as const).map(f => <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={`h-9 rounded-full border px-4 text-sm font-medium ${filter === f ? 'border-brand bg-brand-soft text-brand' : 'border-line-strong hover:bg-surface2'}`}>{f === 'all' ? 'All' : `Unread (${unread.length})`}</button>)}</div>
      {n.loading ? <Skeleton className="h-48" /> : n.error ? <ErrorState message={n.error.message} onRetry={n.reload} /> : !list.length ? <Card><EmptyState icon={<Bell size={22} />} title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'} description="Updates about your loans, payments and membership will appear here." /></Card> :
        <Card padded={false}><ul className="divide-y divide-line">{list.map(x => <li key={x.id} className="flex items-start gap-3 p-4">
          <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${x.read_at ? 'bg-transparent' : 'bg-brand'}`} aria-hidden /><div className="min-w-0 flex-1"><p className="flex flex-wrap items-center gap-2 font-semibold">{x.title}{!x.read_at && <Badge tone="brand">New</Badge>}</p><p className="text-sm text-muted">{x.body}</p><p className="mt-1 text-xs text-muted">{dateTime(x.created_at)}</p></div>
          {!x.read_at && <Button size="sm" variant="ghost" onClick={() => run(() => api('POST', `/notifications/${x.id}/read`))}>Mark read</Button>}</li>)}</ul></Card>}</TabPanel>
    <TabPanel id="announcements" active={tab === 'announcements'}>{a.loading ? <Skeleton className="h-48" /> : !a.data?.length ? <Card><EmptyState icon={<Megaphone size={22} />} title="No announcements" /></Card> :
      <div className="grid gap-4">{a.data.map(x => <Card key={x.id}><div className="mb-1 flex items-center gap-2"><Badge tone={x.kind === 'agm' ? 'warning' : x.kind === 'meeting' ? 'info' : 'neutral'}>{x.kind === 'agm' ? 'AGM' : x.kind === 'meeting' ? 'Meeting notice' : 'Notice'}</Badge><span className="text-xs text-muted">{dateTime(x.created_at)}</span></div><h3 className="font-semibold">{x.title}</h3><p className="mt-1 whitespace-pre-line text-sm text-muted">{x.body}</p></Card>)}</div>}</TabPanel>
  </>;
}

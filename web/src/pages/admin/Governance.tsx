import { useState } from 'react';
import { CalendarPlus, FileText, Plus, Users } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Skeleton } from '../../components/ui/primitives';
import { PageHeader } from '../../components/ui/dashboard';
import { Tabs, TabPanel, useTabParam } from '../../components/ui/data';
import { FormField, Input, SearchInput, Textarea } from '../../components/ui/forms';
import { Drawer, Modal, useAction } from '../../components/ui/overlay';
import { api, invalidate, useApi } from '../../lib/api';
import { date, dateTime } from '../../lib/format';
import { PollCard } from '../member/Governance';

export function PollForm({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState(''); const [opts, setOpts] = useState(['Yes', 'No']); const [closes, setCloses] = useState(''); const [res, setRes] = useState(false); const [run, busy] = useAction(() => { invalidate(); onClose(); });
  const ok = q.trim() && opts.filter(o => o.trim()).length >= 2 && closes && new Date(closes) > new Date();
  return <Modal title="New poll or resolution" onClose={onClose} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!ok} loading={busy} onClick={() => run(() => api('POST', '/polls', { question: q, options: opts.filter(o => o.trim()), closesAt: new Date(closes).toISOString(), isResolution: res }), 'Voting is open')}>Open voting</Button></>}>
    <FormField label="Question or resolution" required><Textarea value={q} onChange={e => setQ(e.target.value)} /></FormField>
    <fieldset className="mb-4"><legend className="mb-1.5 text-sm font-medium">Options <span className="text-danger">*</span></legend><div className="grid gap-2">{opts.map((o, i) => <Input key={i} aria-label={`Option ${i + 1}`} value={o} onChange={e => setOpts(a => a.map((x, j) => (j === i ? e.target.value : x)))} />)}</div>{opts.length < 6 && <Button size="sm" variant="ghost" className="mt-2" icon={<Plus size={14} />} onClick={() => setOpts(a => [...a, ''])}>Add option</Button>}</fieldset>
    <FormField label="Voting closes" required error={closes && new Date(closes) <= new Date() ? 'Choose a time in the future' : undefined}><Input type="datetime-local" value={closes} onChange={e => setCloses(e.target.value)} /></FormField>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--c-brand)]" checked={res} onChange={e => setRes(e.target.checked)} />This is a formal resolution</label></Modal>;
}

function MeetingForm({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ title: '', heldAt: '', venue: '' }); const [run, busy] = useAction(() => { invalidate(); onClose(); });
  return <Modal title="Schedule a meeting" onClose={onClose} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!f.title.trim() || !f.heldAt} loading={busy} onClick={() => run(() => api('POST', '/meetings', { title: f.title, heldAt: new Date(f.heldAt).toISOString(), venue: f.venue || undefined }), 'Meeting scheduled')}>Schedule</Button></>}>
    <FormField label="Title" required><Input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></FormField><FormField label="Date and time" required><Input type="datetime-local" value={f.heldAt} onChange={e => setF({ ...f, heldAt: e.target.value })} /></FormField><FormField label="Venue"><Input value={f.venue} onChange={e => setF({ ...f, venue: e.target.value })} /></FormField></Modal>;
}

function MeetingDrawer({ m, onClose }: { m: any; onClose: () => void }) {
  const att = useApi<any[]>(`/meetings/${m.id}/attendance`); const [mins, setMins] = useState<string>(m.minutes ?? ''); const [run, busy] = useAction(() => invalidate('/meetings'));
  return <Drawer title={m.title} subtitle={`${dateTime(m.held_at)}${m.venue ? ' · ' + m.venue : ''}`} onClose={onClose} width="max-w-xl"><div className="grid gap-6">
    <section><h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Minutes</h3><Textarea className="min-h-40" value={mins} onChange={e => setMins(e.target.value)} placeholder="Record decisions and discussion…" /><Button className="mt-2" loading={busy} disabled={!mins.trim()} onClick={() => run(() => api('POST', `/meetings/${m.id}/minutes`, { minutes: mins }), 'Minutes saved')}>Save minutes</Button></section>
    <section><h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Attendance ({att.data?.length ?? 0})</h3>{att.loading ? <Skeleton className="h-20" /> : att.data?.length ? <ul className="divide-y divide-line rounded-xl border border-line">{att.data.map(a => <li key={a.membership_id} className="flex justify-between gap-3 p-3 text-sm"><span className="font-medium">{a.first_name} {a.last_name}</span><span className="text-muted">{a.membership_id} · {dateTime(a.checked_in_at)}</span></li>)}</ul> : <p className="text-sm text-muted">Nobody has checked in yet. Members can check in within 12 hours of the meeting time.</p>}</section></div></Drawer>;
}

export default function AdminGovernance() {
  const [tab, setTab] = useTabParam('meetings', ['meetings', 'voting', 'minutes']); const [q, setQ] = useState(''); const meetings = useApi<any[]>(`/meetings${q ? `?q=${encodeURIComponent(q)}` : ''}`); const polls = useApi<any[]>('/polls');
  const [sel, setSel] = useState<any>(null); const [mf, setMf] = useState(false); const [pf, setPf] = useState(false);
  return <>
    <PageHeader title="Governance" description="Meetings, attendance, minutes, resolutions and voting." actions={tab === 'voting' ? <Button icon={<Plus size={16} />} onClick={() => setPf(true)}>New poll / resolution</Button> : <Button icon={<CalendarPlus size={16} />} onClick={() => setMf(true)}>Schedule meeting</Button>} />
    <Tabs value={tab} onChange={setTab} tabs={[{ key: 'meetings', label: 'Meetings & attendance' }, { key: 'voting', label: 'Voting & resolutions' }, { key: 'minutes', label: 'Minutes archive' }]} />
    <TabPanel id="meetings" active={tab === 'meetings'}>{!meetings.data?.length ? <Card><EmptyState icon={<Users size={22} />} title="No meetings scheduled" action={<Button onClick={() => setMf(true)}>Schedule meeting</Button>} /></Card> : <div className="grid gap-3">{meetings.data.map(m => <Card key={m.id}><button className="flex w-full items-center gap-3 text-left" onClick={() => setSel(m)}><div className="min-w-0 flex-1"><p className="font-semibold">{m.title}</p><p className="text-sm text-muted">{dateTime(m.held_at)}{m.venue ? ` · ${m.venue}` : ''}</p></div><Badge>{m.attendees} attended</Badge>{m.minutes && <Badge tone="success">Minutes</Badge>}</button></Card>)}</div>}</TabPanel>
    <TabPanel id="voting" active={tab === 'voting'}>{!polls.data?.length ? <Card><EmptyState title="No polls or resolutions" /></Card> : <div className="grid gap-4">{polls.data.map(p => <PollCard key={p.id} p={p} />)}</div>}</TabPanel>
    <TabPanel id="minutes" active={tab === 'minutes'}><SearchInput className="mb-4 max-w-sm" value={q} onChange={setQ} placeholder="Search minutes and meetings" />{(meetings.data ?? []).filter(m => m.minutes).length ? <div className="grid gap-3">{meetings.data!.filter(m => m.minutes).map(m => <Card key={m.id}><div className="mb-1 flex items-center gap-2"><FileText size={16} className="text-muted" /><p className="font-semibold">{m.title}</p><span className="text-sm text-muted">{date(m.held_at)}</span></div><p className="line-clamp-3 whitespace-pre-line text-sm text-muted">{m.minutes}</p></Card>)}</div> : <Card><EmptyState icon={<FileText size={22} />} title="No minutes recorded" description="Open a meeting to record its minutes." /></Card>}</TabPanel>
    {sel && <MeetingDrawer m={sel} onClose={() => { setSel(null); meetings.reload(); }} />}{mf && <MeetingForm onClose={() => setMf(false)} />}{pf && <PollForm onClose={() => setPf(false)} />}
  </>;
}

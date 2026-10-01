import { useState } from 'react';
import { CalendarDays, CheckCircle2, FileText, QrCode, Vote } from 'lucide-react';
import { Alert, Badge, Button, Card, EmptyState, ErrorState, Skeleton } from '../../components/ui/primitives';
import { PageHeader } from '../../components/ui/dashboard';
import { Tabs, TabPanel, useTabParam } from '../../components/ui/data';
import { Modal, useAction, useConfirm } from '../../components/ui/overlay';
import { SearchInput } from '../../components/ui/forms';
import { api, invalidate, useApi } from '../../lib/api';
import { date, dateTime } from '../../lib/format';

export function PollCard({ p, onVote }: { p: any; onVote?: (i: number) => void }) {
  const total = Object.values(p.tally ?? {}).reduce((a: number, b: any) => a + Number(b), 0), voted = p.my_vote != null, showResults = voted || !p.open || !onVote;
  return <Card><div className="mb-1 flex flex-wrap items-center gap-2">{p.is_resolution ? <Badge tone="info">Resolution</Badge> : <Badge>Poll</Badge>}{p.open ? <Badge tone="success">Voting open</Badge> : <Badge>Closed</Badge>}<span className="text-xs text-muted">{p.open ? 'Closes' : 'Closed'} {dateTime(p.closes_at)}</span></div>
    <h3 className="mb-4 text-lg font-semibold">{p.question}</h3>
    <ul className="grid gap-2.5">{p.options.map((o: string, i: number) => { const n = Number(p.tally?.[i] ?? 0), share = total ? (n / total) * 100 : 0, mine = p.my_vote === i;
      return <li key={i}>{showResults ? <div className={`relative overflow-hidden rounded-xl border p-3.5 ${mine ? 'border-brand' : 'border-line'}`}><div className="absolute inset-y-0 left-0 bg-brand-soft" style={{ width: `${share}%` }} aria-hidden />
        <div className="relative flex items-center justify-between gap-3"><span className="flex items-center gap-2 font-medium">{mine && <CheckCircle2 size={17} className="text-brand" aria-label="Your vote" />}{o}</span><span className="num text-sm font-semibold">{n} · {Math.round(share)}%</span></div></div>
        : <button onClick={() => onVote!(i)} className="flex min-h-14 w-full items-center gap-3 rounded-xl border-2 border-line-strong p-3.5 text-left text-base font-semibold transition hover:border-brand hover:bg-brand-soft"><span className="grid size-6 place-items-center rounded-full border-2 border-line-strong" aria-hidden />{o}</button>}</li>; })}</ul>
    <p className="mt-3 text-xs text-muted">{total} vote{total === 1 ? '' : 's'} cast · one member, one vote{voted ? ' · you have voted' : ''}</p></Card>;
}

const KEYS = ['voting', 'meetings', 'agm', 'documents', 'minutes'];
export default function Governance() {
  const [tab, setTab] = useTabParam('voting', KEYS); const polls = useApi<any[]>('/polls'); const [q, setQ] = useState(''); const meetings = useApi<any[]>(`/meetings${q ? `?q=${encodeURIComponent(q)}` : ''}`); const ann = useApi<any[]>('/announcements'); const confirm = useConfirm();
  const [run] = useAction(() => invalidate()); const [mins, setMins] = useState<any>(null);
  const vote = async (p: any, i: number) => { const c = await confirm({ title: 'Cast your vote', message: <>You are voting <b className="text-ink">“{p.options[i]}”</b> on “{p.question}”. Your vote is final and cannot be changed.</>, confirmLabel: 'Submit my vote' }); if (c.ok) run(() => api('POST', `/polls/${p.id}/vote`, { optionIndex: i }), 'Your vote has been recorded'); };
  const open = polls.data?.filter(p => p.open) ?? [], closed = polls.data?.filter(p => !p.open) ?? [], agm = ann.data?.filter(a => a.kind !== 'notice') ?? [];
  return <>
    <PageHeader title="Governance" description="Vote, attend meetings and follow the decisions of your cooperative." />
    <Tabs value={tab} onChange={setTab} tabs={[{ key: 'voting', label: 'Voting', count: open.length }, { key: 'meetings', label: 'Meetings' }, { key: 'agm', label: 'AGM notices' }, { key: 'documents', label: 'Documents' }, { key: 'minutes', label: 'Minutes' }]} />
    <TabPanel id="voting" active={tab === 'voting'}>{polls.loading ? <Skeleton className="h-48" /> : polls.error ? <ErrorState message={polls.error.message} onRetry={polls.reload} /> : <div className="grid gap-5">
      <Alert tone="info" title="One member, one vote">Every verified member has exactly one vote on each question. Results are shown after you vote.</Alert>
      {open.length ? open.map(p => <PollCard key={p.id} p={p} onVote={i => vote(p, i)} />) : <Card><EmptyState icon={<Vote size={22} />} title="No open votes" description="When a poll or resolution is opened, you can vote here." /></Card>}
      {!!closed.length && <><h2 className="mt-2 text-base font-semibold">Past results</h2>{closed.map(p => <PollCard key={p.id} p={p} />)}</>}</div>}</TabPanel>
    <TabPanel id="meetings" active={tab === 'meetings'}><MeetingList q={q} setQ={setQ} meetings={meetings} onMinutes={setMins} /></TabPanel>
    <TabPanel id="agm" active={tab === 'agm'}>{agm.length ? <div className="grid gap-4">{agm.map(a => <Card key={a.id}><div className="mb-1 flex items-center gap-2"><Badge tone={a.kind === 'agm' ? 'warning' : 'info'}>{a.kind === 'agm' ? 'AGM notice' : 'Meeting notice'}</Badge><span className="text-xs text-muted">{dateTime(a.created_at)}</span></div><h3 className="font-semibold">{a.title}</h3><p className="mt-1 whitespace-pre-line text-sm text-muted">{a.body}</p></Card>)}</div> : <Card><EmptyState icon={<CalendarDays size={22} />} title="No AGM or meeting notices" /></Card>}</TabPanel>
    <TabPanel id="documents" active={tab === 'documents'}><Card><EmptyState icon={<FileText size={22} />} title="No shared documents yet" description="Constitution, by-laws and annual reports will be shared here by the cooperative office." /></Card></TabPanel>
    <TabPanel id="minutes" active={tab === 'minutes'}><MeetingList q={q} setQ={setQ} meetings={meetings} onMinutes={setMins} minutesOnly /></TabPanel>
    {mins && <Modal size="lg" title={mins.title} description={dateTime(mins.held_at)} onClose={() => setMins(null)}><p className="whitespace-pre-line text-sm">{mins.minutes}</p></Modal>}
  </>;
}

function MeetingList({ q, setQ, meetings, onMinutes, minutesOnly }: { q: string; setQ: (v: string) => void; meetings: ReturnType<typeof useApi<any[]>>; onMinutes: (m: any) => void; minutesOnly?: boolean }) {
  const [run, busy] = useAction(() => invalidate('/meetings'));
  const list = (meetings.data ?? []).filter(m => !minutesOnly || m.minutes);
  return <div className="grid gap-4"><SearchInput value={q} onChange={setQ} placeholder={minutesOnly ? 'Search minutes' : 'Search meetings'} className="max-w-sm" />
    {meetings.loading ? <Skeleton className="h-40" /> : !list.length ? <Card><EmptyState icon={<CalendarDays size={22} />} title={minutesOnly ? 'No minutes found' : 'No meetings found'} description={q ? 'Try a different search.' : undefined} /></Card> :
      list.map(m => { const upcoming = new Date(m.held_at) > new Date(), near = Math.abs(+new Date(m.held_at) - Date.now()) < 12 * 3600e3; return <Card key={m.id}><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="mb-0.5 flex items-center gap-2"><h3 className="font-semibold">{m.title}</h3>{upcoming ? <Badge tone="info">Upcoming</Badge> : <Badge>Held</Badge>}</div>
        <p className="text-sm text-muted">{dateTime(m.held_at)}{m.venue ? ` · ${m.venue}` : ''} · {m.attendees} attended</p></div>
        <div className="flex gap-2">{m.minutes && <Button size="sm" variant="outline" icon={<FileText size={15} />} onClick={() => onMinutes(m)}>Minutes</Button>}
          {near && <Button size="sm" icon={<QrCode size={15} />} loading={busy} onClick={() => run(() => api('POST', `/meetings/${m.id}/checkin`), 'You are checked in')}>Check in</Button>}</div></div></Card>; })}</div>;
}

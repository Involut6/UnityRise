import { useState } from 'react';
import { Bell, CheckCircle2, Mail, MessageSquare, Send, Smartphone, Megaphone } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Tooltip } from '../../components/ui/primitives';
import { PageHeader } from '../../components/ui/dashboard';
import { Tabs, TabPanel, useTabParam } from '../../components/ui/data';
import { FormField, Input, OptionCard, Select, Textarea } from '../../components/ui/forms';
import { useAction, useConfirm } from '../../components/ui/overlay';
import { api, invalidate, useApi } from '../../lib/api';
import { dateTime } from '../../lib/format';
import { PollForm } from './Governance';
import { PollCard } from '../member/Governance';

const CHANNELS = [[Bell, 'In-app notification', true, 'Delivered instantly to every verified member'], [Smartphone, 'Push notification', false, 'Needs Firebase Cloud Messaging keys'], [MessageSquare, 'SMS', false, 'Needs a Termii or Infobip account'], [Mail, 'Email', false, 'Needs a SendGrid API key']] as const;
export default function Communication() {
  const [tab, setTab] = useTabParam('compose', ['compose', 'history', 'polls']); const ann = useApi<any[]>('/announcements'); const polls = useApi<any[]>('/polls'); const ov = useApi<any>('/admin/overview'); const confirm = useConfirm();
  const [f, setF] = useState({ title: '', body: '', kind: 'notice' }); const [run, busy] = useAction(() => { invalidate(); setF({ title: '', body: '', kind: 'notice' }); }); const [poll, setPoll] = useState(false);
  const send = async () => { const c = await confirm({ title: 'Send to all members?', message: <>“{f.title}” will be delivered to <b className="text-ink">{ov.data?.activeMembers ?? 'all'}</b> verified member{ov.data?.activeMembers === 1 ? '' : 's'}. This cannot be recalled.</>, confirmLabel: 'Send now' }); if (c.ok) run(() => api('POST', '/announcements', f), 'Announcement sent'); };
  return <>
    <PageHeader title="Communication" description="Reach members with announcements, meeting notices and polls." />
    <Tabs value={tab} onChange={setTab} tabs={[{ key: 'compose', label: 'Compose' }, { key: 'history', label: 'Sent', count: ann.data?.length }, { key: 'polls', label: 'Polls & voting' }]} />
    <TabPanel id="compose" active={tab === 'compose'}><div className="grid gap-5 lg:grid-cols-3"><Card className="lg:col-span-2"><CardHeader title="New announcement" />
      <FormField label="Type"><Select value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })}><option value="notice">General notice</option><option value="meeting">Meeting notice</option><option value="agm">AGM announcement</option></Select></FormField>
      <FormField label="Title" required><Input value={f.title} maxLength={120} onChange={e => setF({ ...f, title: e.target.value })} /></FormField><FormField label="Message" required><Textarea className="min-h-36" value={f.body} onChange={e => setF({ ...f, body: e.target.value })} /></FormField>
      <Button icon={<Send size={16} />} loading={busy} disabled={!f.title.trim() || !f.body.trim()} onClick={send}>Send to all members</Button></Card>
      <Card><CardHeader title="Channels" subtitle="Where this message is delivered" /><ul className="grid gap-2">{CHANNELS.map(([I, l, on, d]) => <li key={l} className={`flex items-start gap-3 rounded-xl border p-3 ${on ? 'border-brand bg-brand-soft' : 'border-line opacity-80'}`}><I size={18} className="mt-0.5 shrink-0" aria-hidden /><div className="min-w-0 flex-1"><p className="font-medium">{l}</p><p className="text-xs text-muted">{d}</p></div>
        {on ? <Badge tone="success" icon={<CheckCircle2 size={12} />}>Active</Badge> : <Tooltip text="Not configured yet"><Badge>Not set up</Badge></Tooltip>}</li>)}</ul></Card></div></TabPanel>
    <TabPanel id="history" active={tab === 'history'}>{!ann.data?.length ? <Card><EmptyState icon={<Megaphone size={22} />} title="Nothing sent yet" /></Card> : <div className="grid gap-4">{ann.data.map(a => <Card key={a.id}><div className="mb-1 flex flex-wrap items-center gap-2"><Badge tone={a.kind === 'agm' ? 'warning' : a.kind === 'meeting' ? 'info' : 'neutral'}>{a.kind === 'agm' ? 'AGM' : a.kind === 'meeting' ? 'Meeting notice' : 'Notice'}</Badge><Badge tone="success" icon={<CheckCircle2 size={12} />}>Delivered in-app</Badge><span className="text-xs text-muted">{dateTime(a.created_at)}</span></div><h3 className="font-semibold">{a.title}</h3><p className="mt-1 whitespace-pre-line text-sm text-muted">{a.body}</p></Card>)}</div>}
      <div className="mt-4"><Alert tone="info">Read receipts and click engagement are not tracked yet. Delivery status shows where the message was sent.</Alert></div></TabPanel>
    <TabPanel id="polls" active={tab === 'polls'}><div className="mb-4 flex justify-end"><Button onClick={() => setPoll(true)}>New poll</Button></div>{!polls.data?.length ? <Card><EmptyState title="No polls yet" /></Card> : <div className="grid gap-4">{polls.data.map(p => <PollCard key={p.id} p={p} />)}</div>}</TabPanel>
    {poll && <PollForm onClose={() => setPoll(false)} />}
  </>;
}

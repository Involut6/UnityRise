import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronLeft, ChevronRight, LogOut, Menu, Repeat, ShieldCheck, UserRound, Users as UsersIcon, Timer } from 'lucide-react';
import { ADMIN_NAV, MEMBER_NAV, type NavGroup, type NavItem } from './nav';
import { Avatar, Badge, Button, PageSkeleton, Tooltip, cn } from '../ui/primitives';
import { Drawer, Modal } from '../ui/overlay';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/api';
import { ThemeToggle } from '../../lib/theme';
import { date, titleCase } from '../../lib/format';

const Logo = ({ small }: { small?: boolean }) => <Link to="/" className="flex items-center gap-2.5 font-bold" aria-label="UnityRise home">
  <span className="grid size-9 place-items-center rounded-xl bg-brand text-on-brand"><ShieldCheck size={20} aria-hidden /></span>{!small && <span className="text-lg tracking-tight">UnityRise</span>}</Link>;

function useBadges(isAdmin: boolean, hasMember: boolean, isStaff: boolean) {
  const ov = useApi<any>(isStaff ? '/admin/overview' : null); const nt = useApi<any[]>(hasMember ? '/notifications' : null);
  return { pendingKyc: isAdmin ? ov.data?.pendingKyc ?? 0 : 0, pendingLoans: ov.data?.pendingLoans ?? 0, unread: nt.data?.filter(n => !n.read_at).length ?? 0 };
}

function visibleGroups(groups: NavGroup[], can: (...r: any[]) => boolean): NavGroup[] {
  return groups.map(g => ({ ...g, items: g.items.filter(i => !i.roles || can(...i.roles)) })).filter(g => g.items.length);
}

function Sidebar({ groups, collapsed, onToggle, badges, mode }: { groups: NavGroup[]; collapsed: boolean; onToggle: () => void; badges: Record<string, number>; mode: 'member' | 'admin' }) {
  const { me, signOut } = useAuth();
  return <aside className={cn('no-print fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface transition-[width] duration-200 md:flex', collapsed ? 'w-[72px]' : 'w-64')} aria-label="Primary">
    <div className={cn('flex h-16 items-center border-b border-line', collapsed ? 'justify-center' : 'justify-between px-5')}><Logo small={collapsed} />
      {!collapsed && mode === 'admin' && <Badge tone="brand">Admin</Badge>}</div>
    <button onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className="absolute -right-3 top-[52px] z-40 grid size-6 place-items-center rounded-full border border-line-strong bg-surface text-muted shadow-card transition hover:bg-brand hover:text-on-brand">
      {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}</button>
    <nav className="scroll-thin flex-1 overflow-y-auto px-3 py-4">{groups.map(g => <div key={g.title} className="mb-5">
      {!collapsed ? <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted">{g.title}</p> : <div className="mx-3 mb-2 border-t border-line first:hidden" />}
      <ul className="grid gap-0.5">{g.items.map(i => <li key={i.to}><NavLink to={i.to} end={i.end} aria-label={collapsed ? i.label : undefined}
        className={({ isActive }) => cn('relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition', collapsed && 'justify-center px-0', isActive ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-surface2 hover:text-ink')}>
        {({ isActive }) => <>{isActive && <span className="absolute inset-y-2 left-0 w-1 rounded-r bg-brand" aria-hidden />}
          {collapsed ? <Tooltip text={i.label} side="right"><span className="relative grid size-10 place-items-center"><i.icon size={20} aria-hidden />{badges[i.badgeKey ?? ''] > 0 && <span className="absolute right-1 top-1 size-2 rounded-full bg-danger" />}</span></Tooltip>
            : <><i.icon size={19} aria-hidden /><span className="flex-1 truncate">{i.label}</span>{badges[i.badgeKey ?? ''] > 0 && <span className="rounded-full bg-danger px-1.5 text-xs font-bold text-white num" aria-label={`${badges[i.badgeKey!]} pending`}>{badges[i.badgeKey!]}</span>}</>}</>}
      </NavLink></li>)}</ul></div>)}</nav>
    <div className="border-t border-line p-3">
      <div className={cn('flex items-center gap-3 rounded-xl p-2', collapsed && 'justify-center')}><Avatar name={me?.first_name ? `${me.first_name} ${me.last_name}` : me?.email ?? '?'} />
        {!collapsed && <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{me?.first_name ? `${me.first_name} ${me.last_name}` : me?.email}</p><p className="truncate text-xs text-muted">{me?.membership_id ?? titleCase(me?.role ?? '')}</p></div>}
        {!collapsed && <button onClick={signOut} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface2 hover:text-ink" aria-label="Sign out"><LogOut size={18} /></button>}</div>
</div></aside>;
}

function MobileNav({ groups, badges }: { groups: NavGroup[]; badges: Record<string, number> }) {
  const [more, setMore] = useState(false); const loc = useLocation(); const { signOut } = useAuth();
  useEffect(() => setMore(false), [loc.pathname]);
  const all = groups.flatMap(g => g.items); const primary = all.filter(i => i.primary).slice(0, 4);
  return <>
    <nav aria-label="Primary" className="no-print fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {primary.map(i => <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => cn('relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold', isActive ? 'text-brand' : 'text-muted')}>
        <i.icon size={22} aria-hidden />{i.label.split(' ')[0]}{badges[i.badgeKey ?? ''] > 0 && <span className="absolute right-[28%] top-2 size-2 rounded-full bg-danger" />}</NavLink>)}
      <button onClick={() => setMore(true)} className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-muted" aria-haspopup="dialog"><Menu size={22} aria-hidden />More</button></nav>
    {more && <Drawer title="Menu" onClose={() => setMore(false)} width="max-w-sm" footer={<Button variant="outline" icon={<LogOut size={16} />} onClick={signOut}>Sign out</Button>}>
      {groups.map(g => <div key={g.title} className="mb-5"><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">{g.title}</p>
        <ul>{g.items.map(i => <li key={i.to}><NavLink to={i.to} end={i.end} className={({ isActive }) => cn('flex h-12 items-center gap-3 rounded-lg px-3 font-medium', isActive ? 'bg-brand-soft text-brand' : 'hover:bg-surface2')}>
          <i.icon size={20} aria-hidden /><span className="flex-1">{i.label}</span>{badges[i.badgeKey ?? ''] > 0 && <Badge tone="danger">{badges[i.badgeKey!]}</Badge>}</NavLink></li>)}</ul></div>)}</Drawer>}</>;
}

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { me, isStaff, can } = useAuth(); const nav = useNavigate();
  const nt = useApi<any[]>(me?.member_id ? '/notifications' : null); const ov = useApi<any>(isStaff ? '/admin/overview' : null);
  const go = (to: string) => { onClose(); nav(to); };
  return <Drawer title="Notifications" onClose={onClose} width="max-w-md" footer={me?.member_id ? <Button variant="outline" onClick={() => go('/notifications')}>View all notifications</Button> : undefined}>
    {isStaff && ov.data && (ov.data.pendingKyc > 0 || ov.data.pendingLoans > 0) && <div className="mb-5 grid gap-2"><p className="text-xs font-semibold uppercase tracking-wider text-muted">Needs your attention</p>
      {ov.data.pendingKyc > 0 && can('admin') && <button onClick={() => go('/admin/kyc')} className="rounded-xl border border-line p-3 text-left hover:bg-surface2"><p className="font-semibold">{ov.data.pendingKyc} KYC application{ov.data.pendingKyc > 1 ? 's' : ''} waiting</p><p className="text-sm text-muted">Review and verify new members</p></button>}
      {ov.data.pendingLoans > 0 && <button onClick={() => go('/admin/loans')} className="rounded-xl border border-line p-3 text-left hover:bg-surface2"><p className="font-semibold">{ov.data.pendingLoans} loan{ov.data.pendingLoans > 1 ? 's' : ''} awaiting approval</p><p className="text-sm text-muted">Open the loan queue</p></button>}</div>}
    {me?.member_id && (nt.data?.length ? <ul className="divide-y divide-line">{nt.data.slice(0, 8).map(n => <li key={n.id} className="py-3"><div className="flex items-start gap-2">{!n.read_at && <span className="mt-2 size-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
      <div className="min-w-0"><p className="font-semibold">{n.title}</p><p className="text-sm text-muted">{n.body}</p><p className="mt-1 text-xs text-muted">{date(n.created_at)}</p></div></div></li>)}</ul> : <p className="py-8 text-center text-muted">You're all caught up.</p>)}
    {!me?.member_id && !(ov.data?.pendingKyc || ov.data?.pendingLoans) && <p className="py-8 text-center text-muted">Nothing needs attention right now.</p>}</Drawer>;
}

function UserMenu() {
  const { me, signOut } = useAuth(); const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false); const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k); return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); }; }, [open]);
  const name = me?.first_name ? `${me.first_name} ${me.last_name}` : me?.email ?? '';
  return <div ref={ref} className="relative"><button onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" className="rounded-full focus-visible:outline-offset-4"><Avatar name={name} size={38} /></button>
    {open && <div role="menu" className="absolute right-0 top-12 z-40 w-64 animate-pop rounded-xl border border-line bg-surface p-1.5 shadow-pop">
      <div className="px-3 py-2"><p className="truncate font-semibold">{name}</p><p className="truncate text-sm text-muted">{me?.email}</p><Badge className="mt-1.5" tone="brand">{titleCase(me?.role ?? '')}</Badge></div><div className="my-1 border-t border-line" />
      <Link role="menuitem" to="/profile" onClick={() => setOpen(false)} className="flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium hover:bg-surface2"><UserRound size={17} />Profile & security</Link>
      <button role="menuitem" onClick={signOut} className="flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-danger hover:bg-danger-soft"><LogOut size={17} />Sign out</button></div>}</div>;
}

function Topbar({ mode, unread }: { mode: 'member' | 'admin'; unread: number }) {
  const { me, isStaff } = useAuth(); const [panel, setPanel] = useState(false); const nav = useNavigate();
  const canSwitch = isStaff && !!me?.member_id;
  return <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur md:px-8">
    <div className="md:hidden"><Logo /></div><div className="flex-1" />
    {canSwitch && <Button size="sm" variant="outline" icon={<Repeat size={15} />} onClick={() => nav(mode === 'admin' ? '/' : '/admin')}><span className="hidden sm:inline">{mode === 'admin' ? 'Member portal' : 'Admin'}</span></Button>}
    <ThemeToggle />
    <button onClick={() => setPanel(true)} className="relative grid size-10 place-items-center rounded-full text-muted hover:bg-surface2 hover:text-ink" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
      <Bell size={21} />{unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white num">{unread > 9 ? '9+' : unread}</span>}</button>
    <UserMenu />{panel && <NotificationPanel onClose={() => setPanel(false)} />}</header>;
}

function IdleDialog() {
  const { idleWarning, staySignedIn, signOut } = useAuth();
  if (idleWarning === null) return null;
  return <Modal size="sm" title="Still there?" onClose={() => staySignedIn().catch(signOut)} footer={<><Button variant="outline" onClick={signOut}>Sign out</Button><Button onClick={() => staySignedIn().catch(signOut)} data-autofocus>Stay signed in</Button></>}>
    <div className="flex items-start gap-3"><Timer className="mt-0.5 text-warning" /><p className="text-sm text-muted">For your security, you'll be signed out in <b className="num text-ink">{idleWarning}s</b> because there has been no activity.</p></div></Modal>;
}

export default function AppShell({ mode }: { mode: 'member' | 'admin' }) {
  const { can, isStaff, isAdmin, me } = useAuth(); const loc = useLocation();
  const [collapsed, setCollapsed] = useState(() => { try { const s = localStorage.getItem('ur.sidebar'); if (s) return s === '1'; } catch { /* ignore */ } return window.innerWidth < 1100; });
  const toggle = () => setCollapsed(c => { try { localStorage.setItem('ur.sidebar', c ? '0' : '1'); } catch { /* ignore */ } return !c; });
  const groups = useMemo(() => visibleGroups(mode === 'admin' ? ADMIN_NAV : MEMBER_NAV, can), [mode, can]);
  const badges = useBadges(isAdmin, !!me?.member_id, isStaff);
  useEffect(() => { window.scrollTo(0, 0); document.getElementById('main')?.focus({ preventScroll: true }); }, [loc.pathname]);
  return <div className="min-h-screen">
    <a href="#main" className="sr-only z-50 rounded-lg bg-brand px-4 py-2 text-on-brand focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
    <Sidebar groups={groups} collapsed={collapsed} onToggle={toggle} badges={badges} mode={mode} />
    <div className={cn('transition-[padding] duration-200', collapsed ? 'md:pl-[72px]' : 'md:pl-64')}>
      <Topbar mode={mode} unread={badges.unread} />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl px-4 pb-28 pt-6 outline-none md:px-8 md:pb-12 md:pt-8"><Suspense fallback={<PageSkeleton />}><Outlet /></Suspense></main></div>
    <MobileNav groups={groups} badges={badges} /><IdleDialog /></div>;
}
export { UsersIcon };

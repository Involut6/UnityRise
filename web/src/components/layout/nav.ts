import { Banknote, BarChart3, Bell, BookOpen, CircleHelp, FileText, FolderOpen, Gavel, HandCoins, LayoutDashboard, Megaphone, PiggyBank, ReceiptText, ScrollText, Settings, ShieldCheck, TrendingUp, UserCog, UserRound, Users, Vote, Wallet, type LucideIcon } from 'lucide-react';
import type { Role } from '../../lib/auth';

export interface NavItem { to: string; label: string; icon: LucideIcon; roles?: Role[]; end?: boolean; badgeKey?: 'pendingKyc' | 'pendingLoans' | 'unread'; primary?: boolean }
export interface NavGroup { title: string; items: NavItem[] }

export const MEMBER_NAV: NavGroup[] = [
  { title: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, primary: true }] },
  { title: 'My money', items: [
    { to: '/savings', label: 'Savings', icon: PiggyBank, primary: true }, { to: '/investments', label: 'Investments', icon: TrendingUp, primary: true },
    { to: '/loans', label: 'Loans', icon: HandCoins, primary: true }, { to: '/transactions', label: 'Transactions', icon: ReceiptText }, { to: '/statements', label: 'Statements', icon: FileText } ] },
  { title: 'Community', items: [{ to: '/notifications', label: 'Notifications', icon: Bell, badgeKey: 'unread' }, { to: '/governance', label: 'Governance', icon: Vote }] },
  { title: 'Account', items: [{ to: '/profile', label: 'Profile & security', icon: UserRound }, { to: '/help', label: 'Help & support', icon: CircleHelp }] },
];

export const ADMIN_NAV: NavGroup[] = [
  { title: 'Overview', items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true, primary: true }] },
  { title: 'People', items: [
    { to: '/admin/members', label: 'Members', icon: Users, primary: true },
    { to: '/admin/kyc', label: 'KYC verification', icon: ShieldCheck, roles: ['admin'], badgeKey: 'pendingKyc', primary: true },
    { to: '/admin/users', label: 'Users & roles', icon: UserCog, roles: ['super_admin'] } ] },
  { title: 'Finance', items: [
    { to: '/admin/savings', label: 'Savings', icon: PiggyBank, roles: ['admin', 'accountant'] },
    { to: '/admin/loans', label: 'Loans', icon: HandCoins, roles: ['loan_manager', 'accountant', 'admin'], badgeKey: 'pendingLoans', primary: true },
    { to: '/admin/investments', label: 'Investments', icon: TrendingUp, roles: ['admin', 'accountant'] },
    { to: '/admin/payments', label: 'Payments', icon: Wallet, roles: ['admin', 'accountant'] },
    { to: '/admin/transactions', label: 'Transactions', icon: Banknote, roles: ['admin', 'accountant'] } ] },
  { title: 'Insights', items: [{ to: '/admin/reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'accountant'], primary: true }] },
  { title: 'Engagement', items: [
    { to: '/admin/communication', label: 'Communication', icon: Megaphone, roles: ['admin'] }, { to: '/admin/governance', label: 'Governance', icon: Gavel, roles: ['admin'] },
    { to: '/admin/documents', label: 'Documents', icon: FolderOpen, roles: ['admin'] } ] },
  { title: 'System', items: [{ to: '/admin/audit', label: 'Audit logs', icon: ScrollText, roles: ['admin'] }, { to: '/admin/settings', label: 'Settings', icon: Settings, roles: ['admin'] }] },
];
export { BookOpen };

import { ReactNode, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth, type Role } from './lib/auth';
import AppShell from './components/layout/AppShell';
import { PageSkeleton } from './components/ui/primitives';
import { EmptyState } from './components/ui/primitives';
import { ShieldAlert } from 'lucide-react';

const L = (f: () => Promise<{ default: React.ComponentType }>) => lazy(f);
const Auth = L(() => import('./pages/Auth'));
const Dashboard = L(() => import('./pages/member/Dashboard')); const Savings = L(() => import('./pages/member/Savings'));
const Investments = L(() => import('./pages/member/Investments')); const InvestmentDetail = L(() => import('./pages/member/InvestmentDetail'));
const Loans = L(() => import('./pages/member/Loans')); const LoanApply = L(() => import('./pages/member/LoanApply'));
const Transactions = L(() => import('./pages/member/Transactions')); const Statements = L(() => import('./pages/member/Statements'));
const Notifications = L(() => import('./pages/member/Notifications')); const Governance = L(() => import('./pages/member/Governance'));
const Profile = L(() => import('./pages/member/Profile')); const Help = L(() => import('./pages/member/Help')); const Verification = L(() => import('./pages/member/Verification'));
const AdminDashboard = L(() => import('./pages/admin/Dashboard')); const Members = L(() => import('./pages/admin/Members')); const MemberDetail = L(() => import('./pages/admin/MemberDetail'));
const Kyc = L(() => import('./pages/admin/Kyc')); const AdminSavings = L(() => import('./pages/admin/Savings')); const AdminLoans = L(() => import('./pages/admin/Loans'));
const AdminInvestments = L(() => import('./pages/admin/Investments')); const Payments = L(() => import('./pages/admin/Payments')); const AdminTransactions = L(() => import('./pages/admin/Transactions'));
const Reports = L(() => import('./pages/admin/Reports')); const Communication = L(() => import('./pages/admin/Communication')); const AdminGovernance = L(() => import('./pages/admin/Governance'));
const Documents = L(() => import('./pages/admin/Documents')); const Users = L(() => import('./pages/admin/Users')); const Audit = L(() => import('./pages/admin/Audit')); const Settings = L(() => import('./pages/admin/Settings'));

function Forbidden() { return <EmptyState icon={<ShieldAlert size={22} />} title="You don't have access to this page" description="Your role doesn't include this area. Contact an administrator if you think this is a mistake." />; }
function Roles({ roles, children }: { roles: Role[]; children: ReactNode }) { const { can } = useAuth(); return can(...roles) ? <>{children}</> : <Forbidden />; }

function MemberGate({ children }: { children: ReactNode }) {
  const { me, approved } = useAuth(); const { pathname } = useLocation();
  if (!me?.member_id) return <Navigate to="/admin" replace />;
  const open = ['/verification', '/profile', '/help'].some(p => pathname.startsWith(p));
  if (!approved && !open) return <Navigate to="/verification" replace />;
  return <>{children}</>;
}
function StaffGate({ children }: { children: ReactNode }) { const { isStaff } = useAuth(); return isStaff ? <>{children}</> : <Navigate to="/" replace />; }

export default function App() {
  const { me, loading } = useAuth();
  if (loading) return <div className="mx-auto max-w-5xl p-8"><PageSkeleton /></div>;
  if (!me) return <Routes><Route path="*" element={<Auth />} /></Routes>;
  const A = (el: ReactNode, roles?: Role[]) => (roles ? <Roles roles={roles}>{el}</Roles> : el);
  const E = (C: React.ComponentType, roles?: Role[]) => A(<C />, roles);
  return <Routes>
    <Route element={<MemberGate><AppShell mode="member" /></MemberGate>}>
      <Route index element={E(Dashboard)} /><Route path="savings" element={E(Savings)} /><Route path="investments" element={E(Investments)} /><Route path="investments/:id" element={E(InvestmentDetail)} />
      <Route path="loans" element={E(Loans)} /><Route path="loans/apply" element={E(LoanApply)} /><Route path="transactions" element={E(Transactions)} /><Route path="statements" element={E(Statements)} />
      <Route path="notifications" element={E(Notifications)} /><Route path="governance" element={E(Governance)} /><Route path="profile" element={E(Profile)} /><Route path="help" element={E(Help)} /><Route path="verification" element={E(Verification)} />
    </Route>
    <Route path="admin" element={<StaffGate><AppShell mode="admin" /></StaffGate>}>
      <Route index element={E(AdminDashboard)} /><Route path="members" element={E(Members)} /><Route path="members/:id" element={E(MemberDetail)} />
      <Route path="kyc" element={E(Kyc, ['admin'])} /><Route path="users" element={E(Users, ['super_admin'])} /><Route path="savings" element={E(AdminSavings, ['admin', 'accountant'])} />
      <Route path="loans" element={E(AdminLoans, ['loan_manager', 'accountant', 'admin'])} /><Route path="investments" element={E(AdminInvestments, ['admin', 'accountant'])} />
      <Route path="payments" element={E(Payments, ['admin', 'accountant'])} /><Route path="transactions" element={E(AdminTransactions, ['admin', 'accountant'])} />
      <Route path="reports" element={E(Reports, ['admin', 'accountant'])} /><Route path="communication" element={E(Communication, ['admin'])} /><Route path="governance" element={E(AdminGovernance, ['admin'])} />
      <Route path="documents" element={E(Documents, ['admin'])} /><Route path="audit" element={E(Audit, ['admin'])} /><Route path="settings" element={E(Settings, ['admin'])} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}

import { ButtonHTMLAttributes, ReactNode, forwardRef } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, Info, Inbox, Loader2, RefreshCw, XCircle, Undo2, CircleDashed, Send, Wallet } from 'lucide-react';

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ---- Button ---- */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-on-brand hover:bg-brand-hover shadow-sm',
  secondary: 'bg-brand-soft text-brand hover:brightness-95',
  outline: 'border border-line-strong bg-surface text-ink hover:bg-surface2',
  ghost: 'text-ink hover:bg-surface2',
  danger: 'bg-danger text-white hover:brightness-110',
};
const SIZE = { sm: 'h-9 px-3 text-sm', md: 'h-11 md:h-10 px-4 text-sm', lg: 'h-12 px-6 text-base' };
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: keyof typeof SIZE; loading?: boolean; icon?: ReactNode; block?: boolean }
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ variant = 'primary', size = 'md', loading, icon, block, className, children, disabled, type = 'button', ...p }, ref) => (
  <button ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined}
    className={cn('inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition disabled:opacity-55', VARIANT[variant], SIZE[size], block && 'w-full', className)} {...p}>
    {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : icon}{children}
  </button>
));

/* ---- Card ---- */
export const Card = ({ className, children, padded = true }: { className?: string; children: ReactNode; padded?: boolean }) =>
  <section className={cn('rounded-2xl border border-line bg-surface shadow-card', padded && 'p-5', className)}>{children}</section>;
export const CardHeader = ({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) => (
  <div className="mb-4 flex items-start gap-3"><div className="min-w-0 flex-1"><h2 className="text-base font-semibold">{title}</h2>{subtitle && <p className="text-sm text-muted">{subtitle}</p>}</div>{action}</div>
);

/* ---- Badges ---- */
type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';
const TONE: Record<Tone, string> = { neutral: 'bg-surface2 text-muted ring-line', success: 'bg-success-soft text-success ring-success/20', warning: 'bg-warning-soft text-warning ring-warning/20',
  danger: 'bg-danger-soft text-danger ring-danger/20', info: 'bg-info-soft text-info ring-info/20', brand: 'bg-brand-soft text-brand ring-brand/20' };
export const Badge = ({ tone = 'neutral', icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) =>
  <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', TONE[tone], className)}>{icon}{children}</span>;

/** Status → tone + icon + text. Never colour alone. */
const STATUS: Record<string, [Tone, ReactNode, string?]> = {
  success: ['success', <CheckCircle2 size={13} />, 'Successful'], approved: ['success', <CheckCircle2 size={13} />], active: ['success', <CheckCircle2 size={13} />], completed: ['success', <CheckCircle2 size={13} />],
  accepted: ['success', <CheckCircle2 size={13} />], matured: ['success', <CheckCircle2 size={13} />], disbursed: ['success', <Send size={13} />],
  open: ['info', <CircleDashed size={13} />], closed: ['info', <Clock size={13} />], processing: ['info', <Loader2 size={13} />, 'Processing'],
  pending: ['warning', <Clock size={13} />], submitted: ['warning', <Clock size={13} />], under_review: ['warning', <Clock size={13} />, 'Under review'], guarantors_pending: ['warning', <Clock size={13} />, 'Awaiting guarantors'],
  draft: ['neutral', <CircleDashed size={13} />], reversed: ['neutral', <Undo2 size={13} />],
  rejected: ['danger', <XCircle size={13} />], declined: ['danger', <XCircle size={13} />], failed: ['danger', <XCircle size={13} />], defaulted: ['danger', <AlertTriangle size={13} />],
  credit: ['success', <Wallet size={13} />], debit: ['neutral', <Wallet size={13} />],
};
export const StatusBadge = ({ status }: { status: string }) => {
  const [tone, icon, label] = STATUS[status] ?? ['neutral', null, undefined];
  return <Badge tone={tone} icon={icon}>{label ?? status.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())}</Badge>;
};

/* ---- Alert ---- */
const ALERT: Record<'info' | 'success' | 'warning' | 'danger', [string, ReactNode]> = {
  info: ['bg-info-soft text-info', <Info size={18} />], success: ['bg-success-soft text-success', <CheckCircle2 size={18} />],
  warning: ['bg-warning-soft text-warning', <AlertTriangle size={18} />], danger: ['bg-danger-soft text-danger', <AlertCircle size={18} />],
};
export const Alert = ({ tone = 'info', title, children, action }: { tone?: keyof typeof ALERT; title?: string; children?: ReactNode; action?: ReactNode }) => (
  <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex items-start gap-3 rounded-xl p-4 text-sm', ALERT[tone][0])}>
    <span className="mt-0.5 shrink-0">{ALERT[tone][1]}</span><div className="min-w-0 flex-1">{title && <p className="font-semibold">{title}</p>}{children && <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>}</div>{action}
  </div>
);

/* ---- Loading / empty / error ---- */
export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden className={cn('animate-pulse rounded-lg bg-line/70', className)} />;
export const CardSkeleton = ({ rows = 3 }: { rows?: number }) => <Card><Skeleton className="mb-4 h-5 w-1/3" />{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="mb-2 h-4 w-full last:mb-0" />)}</Card>;
export const PageSkeleton = () => <div className="grid gap-5" aria-busy="true" aria-label="Loading"><Skeleton className="h-8 w-56" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div><Skeleton className="h-72" /></div>;
export const EmptyState = ({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) => (
  <div className="flex flex-col items-center px-4 py-10 text-center"><div className="mb-3 grid size-12 place-items-center rounded-full bg-surface2 text-muted">{icon ?? <Inbox size={22} />}</div>
    <p className="font-semibold">{title}</p>{description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}{action && <div className="mt-4">{action}</div>}</div>
);
export const ErrorState = ({ message = 'We could not load this.', onRetry }: { message?: string; onRetry?: () => void }) => (
  <div role="alert" className="flex flex-col items-center px-4 py-10 text-center"><div className="mb-3 grid size-12 place-items-center rounded-full bg-danger-soft text-danger"><AlertCircle size={22} /></div>
    <p className="font-semibold">Something went wrong</p><p className="mt-1 max-w-sm text-sm text-muted">{message}</p>{onRetry && <Button className="mt-4" variant="outline" icon={<RefreshCw size={16} />} onClick={onRetry}>Try again</Button>}</div>
);

/* ---- Progress ---- */
export const ProgressBar = ({ value, label, tone = 'brand', size = 'md' }: { value: number; label?: string; tone?: 'brand' | 'success' | 'warning'; size?: 'sm' | 'md' }) => {
  const v = Math.max(0, Math.min(100, value || 0));
  return <div role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label} className={cn('overflow-hidden rounded-full bg-line/80', size === 'sm' ? 'h-1.5' : 'h-2.5')}>
    <div className={cn('h-full rounded-full transition-all duration-500', tone === 'brand' ? 'bg-brand' : tone === 'success' ? 'bg-success' : 'bg-warning')} style={{ width: `${v}%` }} /></div>;
};

/* ---- Tooltip (CSS only; shows on hover and keyboard focus) ---- */
export const Tooltip = ({ text, children, side = 'top' }: { text: string; children: ReactNode; side?: 'top' | 'right' }) => (
  <span className="group/tt relative inline-flex">{children}
    <span role="tooltip" className={cn('pointer-events-none absolute z-50 hidden whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-medium text-bg shadow-pop group-hover/tt:block group-focus-within/tt:block',
      side === 'top' ? 'bottom-full left-1/2 mb-1.5 -translate-x-1/2' : 'left-full top-1/2 ml-2 -translate-y-1/2')}>{text}</span></span>
);

export const Avatar = ({ name, size = 36 }: { name: string; size?: number }) => (
  <span aria-hidden className="grid shrink-0 place-items-center rounded-full bg-brand-soft font-semibold text-brand" style={{ width: size, height: size, fontSize: size * 0.38 }}>
    {name.split(/[\s@.]/).filter(Boolean).slice(0, 2).map(x => x[0]!.toUpperCase()).join('')}</span>
);
export const Money = ({ value, className, sign }: { value: string; className?: string; sign?: 'credit' | 'debit' }) =>
  <span className={cn('num font-semibold', sign === 'credit' && 'text-success', className)}>{sign === 'credit' ? '+' : sign === 'debit' ? '−' : ''}{value}</span>;

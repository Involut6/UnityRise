import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { naira } from '../../lib/format';

const PALETTE = ['var(--c-brand)', 'var(--c-info)', 'var(--c-accent)', 'var(--c-warning)', 'var(--c-success)', 'var(--c-danger)'];
type Series = { key: string; label: string; color?: string };
type Props =
  | { kind: 'area'; data: Record<string, any>[]; x: string; series: Series[]; money?: boolean }
  | { kind: 'bars'; data: Record<string, any>[]; x: string; series: Series[]; money?: boolean }
  | { kind: 'donut'; data: { name: string; value: number }[] };

const axis = { stroke: 'var(--c-muted)', fontSize: 12, tickLine: false, axisLine: false } as const;
const tip = { contentStyle: { background: 'var(--c-surface)', border: '1px solid var(--c-line)', borderRadius: 10, color: 'var(--c-ink)', fontSize: 13 }, labelStyle: { fontWeight: 600 } };
const fmt = (money?: boolean) => (v: any) => (money ? naira(v, { compact: true, decimals: false }) : String(v));

export default function Charts(p: Props) {
  if (p.kind === 'donut') return <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={p.data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="85%" paddingAngle={2} stroke="var(--c-surface)">
    {p.data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Pie><Tooltip {...tip} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} /></PieChart></ResponsiveContainer>;
  const common = { data: p.data, margin: { top: 8, right: 8, left: -12, bottom: 0 } };
  const grid = <CartesianGrid stroke="var(--c-line)" vertical={false} />;
  const axes = <><XAxis dataKey={p.x} {...axis} /><YAxis {...axis} tickFormatter={fmt(p.money)} width={56} /><Tooltip {...tip} formatter={(v: any) => (p.money ? naira(v) : v)} /></>;
  const legend = p.series.length > 1 ? <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} /> : null;
  return <ResponsiveContainer width="100%" height="100%">{p.kind === 'area'
    ? <AreaChart {...common}>{grid}{axes}{legend}{p.series.map((s, i) => <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color ?? PALETTE[i]} fill={s.color ?? PALETTE[i]} fillOpacity={0.12} strokeWidth={2.5} />)}</AreaChart>
    : <BarChart {...common}>{grid}{axes}{legend}{p.series.map((s, i) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? PALETTE[i]} radius={[6, 6, 0, 0]} maxBarSize={36} />)}</BarChart>}</ResponsiveContainer>;
}

export const naira = (n: number | string | null | undefined, opts: { compact?: boolean; decimals?: boolean } = {}) => {
  const v = Number(n ?? 0);
  if (opts.compact && Math.abs(v) >= 1_000_000) return '₦' + (v / 1_000_000).toFixed(v % 1_000_000 ? 1 : 0) + 'M';
  if (opts.compact && Math.abs(v) >= 10_000) return '₦' + (v / 1_000).toFixed(0) + 'K';
  return '₦' + v.toLocaleString('en-NG', { minimumFractionDigits: opts.decimals === false ? 0 : 2, maximumFractionDigits: opts.decimals === false ? 0 : 2 });
};
export const date = (d?: string | Date | null) => (d ? new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const dateTime = (d?: string | Date | null) => (d ? new Date(d).toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
export const monthLabel = (ym: string) => new Date(ym + '-01').toLocaleDateString('en-NG', { month: 'short' });
export const pct = (n: number) => `${Number(n).toFixed(Number(n) % 1 ? 1 : 0)}%`;
export const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
export const initials = (s: string) => s.split(/[\s@.]/).filter(Boolean).slice(0, 2).map(x => x[0]!.toUpperCase()).join('');
export const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
export const toISODate = (d: Date) => d.toISOString().slice(0, 10);

export const TXN_LABEL: Record<string, string> = {
  contribution: 'Contribution', topup: 'Deposit', withdrawal: 'Withdrawal', loan_disbursement: 'Loan disbursement',
  loan_repayment: 'Loan repayment', investment_subscription: 'Investment', investment_return: 'Investment return', penalty: 'Late penalty',
};
export const LOAN_LABEL: Record<string, string> = { emergency: 'Emergency', personal: 'Personal', business: 'Business', housing: 'Housing', asset: 'Asset acquisition', education: 'Education' };
export const CATEGORY_LABEL: Record<string, string> = { real_estate: 'Real estate', treasury_bills: 'Treasury bills', agriculture: 'Agriculture', equipment_leasing: 'Equipment leasing', business_financing: 'Business financing' };

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]!);
  const cell = (v: unknown) => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s) && isNaN(Number(s))) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
  return [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\n');
}
export function downloadText(name: string, text: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export const fileToBase64 = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] ?? ''); r.onerror = () => rej(new Error('Could not read file')); r.readAsDataURL(f); });

/** Downscale large photos in the browser so uploads stay small (phone photos are often 3-8MB). PDFs/small images pass through. */
export async function shrinkImage(file: File, maxDim = 1600, quality = 0.85): Promise<File> {
  if (!file.type.startsWith('image/') || file.size < 500 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file); const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/jpeg', quality));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch { return file; }
}

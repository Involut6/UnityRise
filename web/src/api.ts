let token = sessionStorage.getItem('t') ?? '';
export const setToken = (t: string) => { token = t; t ? sessionStorage.setItem('t', t) : sessionStorage.removeItem('t'); };
export const hasToken = () => !!token;
export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch('/api' + path, { method, headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); const data = text ? JSON.parse(text) : null;
  if (r.status === 401 && token) { setToken(''); location.reload(); }
  if (!r.ok) throw new Error(Array.isArray(data?.message) ? data.message.join(', ') : data?.message ?? `Error ${r.status}`);
  return data;
}
export const naira = (n: number | string) => '₦' + Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const date = (d: string) => new Date(d).toLocaleDateString('en-NG', { dateStyle: 'medium' });
